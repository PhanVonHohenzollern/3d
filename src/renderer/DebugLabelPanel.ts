// Port of renderer/DebugLabelPanel.{h,cpp}: a bounded, scrollable legend.
// Labels never occupy the model's center and their order does not change when
// the camera moves or a row is selected.
//
// The C++ widget is a QWidget with a 25 px header QLabel over a LabelList (a
// QListWidget in ExtendedSelection mode) painted by LabelDelegate. This class
// keeps that widget's state and behavior framework-free, including the parts
// of QListWidget / QItemSelectionModel the panel relies on (click, Ctrl
// toggle, Shift range from the anchor, drag selection, keyboard navigation,
// per-pixel scrolling). DebugLabelPanelView.tsx renders it.

import type { QColor } from './OverlayPainter';
import { QRect } from './Rect';
import { LeftButton, RightButton, type KeyboardModifiers } from './QtEvents';
import {
  approximateTextMeasurer,
  elidedText,
  fontHeight,
  fontWithPointSize,
  horizontalAdvance,
  kDefaultFontFamily,
  type FontSpec,
  type TextMeasurer,
} from './TextMetrics';

export interface DebugLabelEntry {
  id: string;
  name: string;
  value: string;
}

export const kDebugLabelHeaderHeight = 25;
export const kDebugLabelScrollBarWidth = 8;
/** LabelDelegate::sizeHint() width; list-mode items stretch to the viewport but never shrink below it. */
const kItemMinimumWidth = 100;
/** QApplication::doubleClickInterval() (Windows default) + 100 ms, QAbstractItemView's delayed auto-scroll. */
const kDelayedAutoScrollMs = 600;

type SelectionOp = 'Select' | 'Deselect' | 'Toggle';

/** QItemSelectionModel::SelectionFlags as used by QAbstractItemView. */
interface SelectionCommand {
  clear?: boolean;
  current?: boolean;
  op?: SelectionOp;
}

const NoUpdate: SelectionCommand = {};
const ClearAndSelect: SelectionCommand = { clear: true, op: 'Select' };
const isNoUpdate = (c: SelectionCommand) => !c.clear && !c.op;

/** Painted layout of one row (LabelDelegate::paint). */
export interface DebugLabelRowLayout {
  selected: boolean;
  /** option.rect width */
  width: number;
  nameText: string;
  nameLeft: number;
  nameWidth: number;
  valueText: string;
  valueLeft: number;
  valueWidth: number;
}

function sameEntries(a: readonly DebugLabelEntry[], b: readonly DebugLabelEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i)
    if (a[i].id !== b[i].id || a[i].name !== b[i].name || a[i].value !== b[i].value) return false;
  return true;
}

function sameSets<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export class DebugLabelPanel {
  private readonly m_title: string;
  readonly color: QColor;
  private m_selected = new Set<string>();
  private m_headerText = '';
  private m_entries: DebugLabelEntry[] = [];
  private m_activated: ((ids: Set<string>, additive: boolean) => void) | null = null;

  // QWidget state. The panel starts hidden (hide() in the constructor).
  private m_geometry = new QRect(0, 0, 0, 0);
  private m_visible = false;
  private m_font: FontSpec = fontWithPointSize(kDefaultFontFamily, 9);
  private m_measurer: TextMeasurer = approximateTextMeasurer;

  // QItemSelectionModel state: committed ranges plus the current (uncommitted) selection.
  private m_ranges = new Set<number>();
  private m_currentSelection = new Set<number>();
  private m_currentCommand: SelectionOp = 'Select';
  private m_currentRow = -1;
  private m_signalsBlocked = false;

  // QAbstractItemView press state.
  private m_currentSelectionStartRow = -1;
  private m_pressedRow = -1;
  private m_pressedContentY = 0;
  private m_noSelectionOnMousePress = false;
  private m_ctrlDragSelectionFlag: SelectionOp | null = null;
  private m_dragSelecting = false;
  private m_basePressActive = false;
  private m_delayedAutoScroll: ReturnType<typeof setTimeout> | null = null;
  private m_scroll = 0;

  // LabelList members.
  private additive = false;
  private handlingInput = false;
  private rangePress = false;
  private rangeAnchor = -1;

  // Change notification for the React view, and parentWidget()->update().
  private readonly m_listeners = new Set<() => void>();
  private m_version = 0;
  private m_parentUpdate: () => void = () => {};

  constructor(title: string, color: QColor) {
    this.m_title = title;
    this.color = color;
  }

  // ---- C++ public API ------------------------------------------------------

  setActivatedCallback(callback: ((ids: Set<string>, additive: boolean) => void) | null): void {
    this.m_activated = callback;
  }

  setEntries(entries: readonly DebugLabelEntry[], selected: ReadonlySet<string>): void {
    // QSignalBlocker block(m_list)
    const wasBlocked = this.m_signalsBlocked;
    this.m_signalsBlocked = true;
    const rebuilt = !sameEntries(entries, this.m_entries);
    if (rebuilt) {
      const scroll = this.m_scroll;
      this.m_entries = entries.map((entry) => ({ ...entry }));
      // m_list->clear(): items, selection, current index and persistent indexes are discarded.
      this.m_ranges.clear();
      this.m_currentSelection.clear();
      this.m_currentRow = -1;
      this.m_currentSelectionStartRow = -1;
      this.m_pressedRow = -1;
      this.rangeAnchor = -1;
      this.setScrollValue(scroll);
      this.m_headerText = `${this.m_title}  (${entries.length})`;
    }
    let newSelection = -1;
    let current = -1;
    for (let i = 0; i < this.m_entries.length; ++i) {
      const entry = entries[i];
      const wanted = selected.has(entry.id);
      if (this.isRowSelected(i) !== wanted) this.select([i], { op: wanted ? 'Select' : 'Deselect' });
      if (this.isRowSelected(i)) {
        current = i;
        if (!this.m_selected.has(entry.id)) newSelection = i;
      }
    }
    if (this.m_currentRow < 0 || !this.isRowSelected(this.m_currentRow)) {
      this.setCurrentIndex(current);
      this.rangeAnchor = this.m_currentRow;
    }
    if (newSelection >= 0) this.scrollToItem(newSelection);
    this.m_selected = new Set(selected);
    this.m_signalsBlocked = wasBlocked;
    this.changed();
  }

  itemIds(): Set<string> {
    return new Set(this.m_entries.map((entry) => entry.id));
  }

  contentHeight(): number {
    return kDebugLabelHeaderHeight + this.m_entries.length * this.rowHeight();
  }

  /** Visible part of the selected row in parent (viewport widget) coordinates; empty when not visible. */
  selectedRowRect(id: string): QRect {
    if (!this.isVisible()) return new QRect();
    for (const row of this.effectiveSelection()) {
      if (this.m_entries[row]?.id !== id) continue;
      const rect = this.visualItemRect(row).intersected(new QRect(0, 0, this.viewportWidth(), this.viewportHeight()));
      return rect.isEmpty()
        ? new QRect()
        : rect.translated(this.m_geometry.x, this.m_geometry.y + kDebugLabelHeaderHeight);
    }
    return new QRect();
  }

  // ---- QWidget -------------------------------------------------------------

  setGeometry(x: number, y: number, width: number, height: number): void {
    const geometry = new QRect(x, y, Math.max(0, width), Math.max(0, height));
    if (
      geometry.x === this.m_geometry.x &&
      geometry.y === this.m_geometry.y &&
      geometry.width === this.m_geometry.width &&
      geometry.height === this.m_geometry.height
    )
      return;
    this.m_geometry = geometry;
    // The scroll bar range follows the new viewport height.
    this.setScrollValue(this.m_scroll);
    this.changed();
  }

  geometry(): QRect {
    return this.m_geometry;
  }

  setVisible(visible: boolean): void {
    if (this.m_visible === visible) return;
    this.m_visible = visible;
    this.changed();
  }

  isVisible(): boolean {
    return this.m_visible;
  }

  setFontFamily(family: string): void {
    if (this.m_font.family === family) return;
    this.m_font = { ...this.m_font, family };
    this.changed();
  }

  setTextMeasurer(measurer: TextMeasurer): void {
    this.m_measurer = measurer;
    this.changed();
  }

  /** The C++ list connects its scroll bar's valueChanged to parentWidget()->update(). */
  setParentUpdate(update: () => void): void {
    this.m_parentUpdate = update;
  }

  dispose(): void {
    if (this.m_delayedAutoScroll !== null) clearTimeout(this.m_delayedAutoScroll);
    this.m_delayedAutoScroll = null;
  }

  // ---- View state ------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.m_listeners.add(listener);
    return () => {
      this.m_listeners.delete(listener);
    };
  };

  getVersion = (): number => this.m_version;

  private changed(): void {
    ++this.m_version;
    for (const listener of [...this.m_listeners]) listener();
  }

  title(): string {
    return this.m_title;
  }
  headerText(): string {
    return this.m_headerText;
  }
  entries(): readonly DebugLabelEntry[] {
    return this.m_entries;
  }
  font(): FontSpec {
    return this.m_font;
  }

  /** max(24, fontMetrics().height() + 8) */
  rowHeight(): number {
    return Math.max(24, fontHeight(this.m_measurer, this.m_font) + 8);
  }

  viewportHeight(): number {
    return Math.max(0, this.m_geometry.height - kDebugLabelHeaderHeight);
  }

  /** The vertical scroll bar (8 px) is shown as needed. */
  hasScrollBar(): boolean {
    return this.m_entries.length * this.rowHeight() > this.viewportHeight();
  }

  viewportWidth(): number {
    return Math.max(0, this.m_geometry.width - (this.hasScrollBar() ? kDebugLabelScrollBarWidth : 0));
  }

  itemWidth(): number {
    return Math.max(kItemMinimumWidth, this.viewportWidth());
  }

  scrollValue(): number {
    return this.m_scroll;
  }

  private maximumScroll(): number {
    return Math.max(0, this.m_entries.length * this.rowHeight() - this.viewportHeight());
  }

  /** QScrollBar::setValue() on the list's vertical scroll bar. */
  private setScrollValue(value: number): void {
    const clamped = Math.min(Math.max(0, Math.round(value)), this.maximumScroll());
    if (clamped === this.m_scroll) return;
    this.m_scroll = clamped;
    this.changed();
    this.m_parentUpdate();
  }

  /** The view scrolled (wheel, scroll bar drag). */
  setScrollValueFromView(value: number): void {
    this.setScrollValue(value);
  }

  /** QListView::visualRect(index), viewport coordinates. */
  private visualItemRect(row: number): QRect {
    const h = this.rowHeight();
    return new QRect(0, row * h - this.m_scroll, this.itemWidth(), h);
  }

  isRowSelected(row: number): boolean {
    if (row < 0) return false;
    const committed = this.m_ranges.has(row);
    if (!this.m_currentSelection.has(row)) return committed;
    if (this.m_currentCommand === 'Select') return true;
    if (this.m_currentCommand === 'Deselect') return false;
    return !committed;
  }

  /** LabelDelegate::paint() layout for one row. */
  rowLayout(row: number): DebugLabelRowLayout {
    const entry = this.m_entries[row];
    const selected = this.isRowSelected(row);
    const font: FontSpec = { ...this.m_font, bold: selected };
    const width = this.itemWidth();
    // content = option.rect.adjusted(17, 0, -7, 0)
    const contentLeft = 17;
    const contentWidth = width - 24;
    const value = entry?.value ?? '';
    const valueWidth = Math.min(
      horizontalAdvance(this.m_measurer, value, font) + 3,
      Math.trunc((contentWidth * 45) / 100),
    );
    const nameWidth = Math.max(0, contentWidth - valueWidth - 8);
    return {
      selected,
      width,
      nameText: elidedText(this.m_measurer, font, entry?.name ?? '', 'ElideMiddle', nameWidth),
      nameLeft: contentLeft,
      nameWidth,
      valueText: elidedText(this.m_measurer, font, value, 'ElideRight', valueWidth),
      valueLeft: contentLeft + contentWidth - valueWidth,
      valueWidth,
    };
  }

  // ---- QItemSelectionModel -------------------------------------------------

  private effectiveSelection(): Set<number> {
    const result = new Set(this.m_ranges);
    for (const row of this.m_currentSelection) {
      if (this.m_currentCommand === 'Select') result.add(row);
      else if (this.m_currentCommand === 'Deselect') result.delete(row);
      else if (result.has(row)) result.delete(row);
      else result.add(row);
    }
    return result;
  }

  /** QItemSelectionModelPrivate::finalize() */
  private finalize(): void {
    this.m_ranges = this.effectiveSelection();
    this.m_currentSelection = new Set();
  }

  /** QItemSelectionModel::select(selection, command) */
  private select(rows: readonly number[], command: SelectionCommand): void {
    const old = this.effectiveSelection();
    if (command.clear) {
      this.m_ranges.clear();
      this.m_currentSelection.clear();
    }
    if (!command.current) this.finalize();
    if (command.op) {
      this.m_currentCommand = command.op;
      this.m_currentSelection = new Set(rows.filter((row) => row >= 0 && row < this.m_entries.length));
    }
    if (!sameSets(old, this.effectiveSelection())) this.itemSelectionChanged();
  }

  /** QItemSelectionModel::setCurrentIndex(index, command), followed by the view's currentChanged() auto-scroll. */
  private setCurrentIndex(row: number, command: SelectionCommand = NoUpdate, autoScroll = true): void {
    if (!isNoUpdate(command)) this.select(row >= 0 ? [row] : [], command);
    if (row === this.m_currentRow) return;
    this.m_currentRow = row;
    if (row >= 0 && autoScroll && this.m_visible) this.scrollToItem(row);
    this.changed();
  }

  /** QListWidget::itemSelectionChanged */
  private itemSelectionChanged(): void {
    this.changed();
    if (this.m_signalsBlocked) return;
    if (!this.handlingInput) this.publishSelection();
  }

  /** The C++ publishSelection lambda (also LabelList::selectionFinished). */
  private publishSelection(): void {
    const selected = new Set<string>();
    for (const row of this.effectiveSelection()) selected.add(this.m_entries[row].id);
    if (this.m_activated) this.m_activated(selected, this.additive);
  }

  /** QListView::scrollTo(index, EnsureVisible) with ScrollPerPixel. */
  private scrollToItem(row: number): void {
    if (row < 0 || row >= this.m_entries.length) return;
    const rect = this.visualItemRect(row);
    const area = new QRect(0, 0, this.viewportWidth(), this.viewportHeight());
    if (rect.top() >= area.top() && rect.bottom() <= area.bottom()) return;
    let value = this.m_scroll;
    if (rect.top() < area.top()) value += rect.top();
    else value += Math.min(rect.top(), rect.bottom() - area.height + 1);
    this.setScrollValue(value);
  }

  /** QListView::indexAt(pos), pos in viewport coordinates. */
  private indexAt(x: number, y: number): number {
    if (x < 0 || x >= this.viewportWidth() || y < 0 || y >= this.viewportHeight()) return -1;
    const row = Math.floor((y + this.m_scroll) / this.rowHeight());
    return row >= 0 && row < this.m_entries.length ? row : -1;
  }

  /** QListView::setSelection(QRect(topLeft, bottomRight), command) over content y coordinates. */
  private setSelection(contentY1: number, contentY2: number, command: SelectionCommand): void {
    const h = this.rowHeight();
    const top = Math.min(contentY1, contentY2);
    const bottom = Math.max(contentY1, contentY2);
    const rows: number[] = [];
    const first = Math.max(0, Math.floor(top / h));
    const last = Math.min(this.m_entries.length - 1, Math.floor(bottom / h));
    for (let row = first; row <= last; ++row) rows.push(row);
    this.select(rows, command);
  }

  private rowCenterContentY(row: number): number {
    const h = this.rowHeight();
    return row * h + Math.trunc((h - 1) / 2);
  }

  /** QAbstractItemViewPrivate::extendedSelectionCommand() */
  private extendedSelectionCommand(
    row: number,
    event: { type: 'press' | 'release' | 'move'; button?: number; modifiers: KeyboardModifiers },
  ): SelectionCommand {
    const shift = event.modifiers.shift;
    const control = event.modifiers.control;
    if (event.type === 'move') {
      // Toggle on MouseMove
      if (control) return { current: true, op: 'Toggle' };
    } else if (event.type === 'press') {
      const rightButtonPressed = event.button === RightButton;
      const indexIsSelected = this.isRowSelected(row);
      if ((shift || control) && rightButtonPressed) return NoUpdate;
      if (!shift && !control && indexIsSelected) return NoUpdate;
      if (row < 0 && !rightButtonPressed && !shift && !control) return { clear: true };
      if (row < 0) return NoUpdate;
      // QListWidget does not enable dragging, so Ctrl never delays a deselect to the release.
    } else {
      // ClearAndSelect on MouseButtonRelease if MouseButtonPress on selected item or empty area
      const rightButtonPressed = event.button === RightButton;
      if (
        ((row === this.m_pressedRow && row >= 0 && this.isRowSelected(row)) || row < 0) &&
        !this.m_dragSelecting &&
        !shift &&
        !control &&
        (!rightButtonPressed || row < 0)
      )
        return ClearAndSelect;
      return NoUpdate;
    }
    if (shift) return { current: true, op: 'Select' };
    if (control) return { op: 'Toggle' };
    if (this.m_dragSelecting) return { clear: true, current: true, op: 'Select' };
    return ClearAndSelect;
  }

  // ---- LabelList input -------------------------------------------------------

  /** LabelList::mousePressEvent; x/y are list viewport coordinates. */
  mousePressEvent(x: number, y: number, button: number, modifiers: KeyboardModifiers): void {
    this.additive = modifiers.control || modifiers.shift;
    this.handlingInput = true;
    const index = this.indexAt(x, y);
    this.rangePress = button === LeftButton && modifiers.shift && this.rangeAnchor >= 0 && index >= 0;
    if (this.rangePress) {
      const first = Math.min(this.rangeAnchor, index);
      const last = Math.max(this.rangeAnchor, index);
      this.setCurrentIndex(index);
      const rows: number[] = [];
      for (let row = first; row <= last; ++row) rows.push(row);
      this.select(rows, modifiers.control ? { op: 'Select' } : ClearAndSelect);
      this.m_basePressActive = false;
    } else {
      this.baseMousePressEvent(x, y, button, modifiers);
      this.rangeAnchor = index;
    }
    this.handlingInput = false;
    this.publishSelection();
  }

  /** QAbstractItemView::mousePressEvent */
  private baseMousePressEvent(x: number, y: number, button: number, modifiers: KeyboardModifiers): void {
    const index = this.indexAt(x, y);
    this.m_basePressActive = true;
    this.m_dragSelecting = false;
    this.m_ctrlDragSelectionFlag = null;
    this.m_pressedRow = index;
    let command = this.extendedSelectionCommand(index, { type: 'press', button, modifiers });
    this.m_noSelectionOnMousePress = isNoUpdate(command) || index < 0;
    const contentY = y + this.m_scroll;
    if (!command.current) {
      this.m_pressedContentY = contentY;
      this.m_currentSelectionStartRow = index;
    } else if (this.m_currentSelectionStartRow < 0) {
      this.m_currentSelectionStartRow = this.m_currentRow;
    }

    if (index >= 0) {
      // Pressing does not auto-scroll immediately; the delayed auto-scroll follows.
      this.setCurrentIndex(index, NoUpdate, false);
      if (command.op === 'Toggle') {
        this.m_ctrlDragSelectionFlag = this.isRowSelected(index) ? 'Deselect' : 'Select';
        command = { ...command, op: this.m_ctrlDragSelectionFlag };
      }
      if (!command.current) {
        this.setSelection(contentY, contentY, command);
      } else {
        const start =
          this.m_currentSelectionStartRow >= 0
            ? this.rowCenterContentY(this.m_currentSelectionStartRow)
            : this.m_scroll;
        this.setSelection(start, contentY, command);
      }
      if (this.m_delayedAutoScroll !== null) clearTimeout(this.m_delayedAutoScroll);
      this.m_delayedAutoScroll = setTimeout(() => {
        this.m_delayedAutoScroll = null;
        if (this.m_pressedRow >= 0) this.scrollToItem(this.m_pressedRow);
      }, kDelayedAutoScrollMs);
    } else {
      // Forces a finalize() even if mouse is pressed, but not on an item
      this.select([], { op: 'Select' });
    }
  }

  /** QAbstractItemView::mouseMoveEvent (drag selection). */
  mouseMoveEvent(x: number, y: number, buttons: number, modifiers: KeyboardModifiers): void {
    if (!(buttons & LeftButton) || !this.m_basePressActive) return;
    const index = this.indexAt(x, y);
    // List mode does not start a selection over empty space.
    if (index < 0) return;
    this.m_dragSelecting = true;
    let command = this.extendedSelectionCommand(index, { type: 'move', modifiers });
    if (this.m_ctrlDragSelectionFlag !== null && command.op === 'Toggle')
      command = { ...command, op: this.m_ctrlDragSelectionFlag };
    this.setSelection(this.m_pressedContentY, y + this.m_scroll, command);
    if (index !== this.m_currentRow) this.setCurrentIndex(index);
  }

  /** LabelList::mouseReleaseEvent */
  mouseReleaseEvent(x: number, y: number, button: number, modifiers: KeyboardModifiers): void {
    if (this.rangePress) {
      this.rangePress = false;
      return;
    }
    const index = this.indexAt(x, y);
    if (this.m_noSelectionOnMousePress) {
      this.m_noSelectionOnMousePress = false;
      this.select(
        index >= 0 ? [index] : [],
        this.extendedSelectionCommand(index, { type: 'release', button, modifiers }),
      );
    }
    this.m_dragSelecting = false;
    this.m_basePressActive = false;
  }

  /**
   * LabelList::keyPressEvent. Returns whether the key was used. Only keys the
   * list handles publish the selection; application shortcuts (Esc) are left
   * to the application, as Qt's shortcut system does before keyPressEvent.
   */
  keyPressEvent(key: string, modifiers: KeyboardModifiers): boolean {
    if (!this.isListKey(key, modifiers)) return false;
    this.additive = modifiers.control || modifiers.shift;
    this.handlingInput = true;
    this.baseKeyPressEvent(key, modifiers);
    this.handlingInput = false;
    this.publishSelection();
    return true;
  }

  private isListKey(key: string, modifiers: KeyboardModifiers): boolean {
    if ((key === 'a' || key === 'A') && modifiers.control && !modifiers.alt) return true;
    return ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' '].includes(key);
  }

  /** QListView::moveCursor() in list mode. */
  private moveCursor(key: string): number {
    const count = this.m_entries.length;
    if (count === 0) return -1;
    const current = this.m_currentRow;
    if (current < 0) return 0;
    const page = Math.max(1, Math.floor(this.viewportHeight() / this.rowHeight()));
    switch (key) {
      case 'ArrowUp':
        return Math.max(0, current - 1);
      case 'ArrowDown':
        return Math.min(count - 1, current + 1);
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
      case 'PageUp':
        return Math.max(0, current - page);
      case 'PageDown':
        return Math.min(count - 1, current + page);
      default:
        return current;
    }
  }

  /** QAbstractItemView::keyPressEvent (ExtendedSelection). */
  private baseKeyPressEvent(key: string, modifiers: KeyboardModifiers): void {
    if ((key === 'a' || key === 'A') && modifiers.control) {
      // QKeySequence::SelectAll
      this.select(
        this.m_entries.map((_, row) => row),
        ClearAndSelect,
      );
      return;
    }
    if (key === ' ') {
      // Toggle on Ctrl+Space, Select on Space
      if (this.m_currentRow >= 0) this.select([this.m_currentRow], { op: modifiers.control ? 'Toggle' : 'Select' });
      return;
    }
    const newCurrent = this.moveCursor(key);
    const oldCurrent = this.m_currentRow;
    if (newCurrent === oldCurrent || newCurrent < 0) return;
    // Ctrl moves the current row without updating the selection.
    const command: SelectionCommand = modifiers.control
      ? NoUpdate
      : modifiers.shift
        ? { current: true, op: 'Select' }
        : ClearAndSelect;
    if (command.current) {
      this.setCurrentIndex(newCurrent);
      if (this.m_currentSelectionStartRow < 0) this.m_currentSelectionStartRow = oldCurrent;
      const start =
        this.m_currentSelectionStartRow >= 0 ? this.rowCenterContentY(this.m_currentSelectionStartRow) : this.m_scroll;
      this.setSelection(start, this.rowCenterContentY(newCurrent), command);
    } else {
      this.setCurrentIndex(newCurrent, command);
      this.m_currentSelectionStartRow = newCurrent;
    }
  }
}

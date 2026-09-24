import { LeftButton } from '../../helpers/qtInput';
import type { KeyboardModifiers } from '../../types/input';
import type { QColor } from '../../types/painting';
import type { FontSpec, TextMeasurer } from '../../types/text';
import type {
  DebugLabelEntry,
  DebugLabelPanelSnapshot,
  DebugLabelRowLayout,
  SelectionCommand,
  SelectionEvent,
  SelectionOp,
} from '../../types/viewportEngine';
import { QRect } from '../../utils/Rect';
import { approximateTextMeasurer, fontHeight, fontWithPointSize, kDefaultFontFamily } from '../../utils/textMetrics';
import { labelRowLayout, sameEntries } from './debugLabelRows';
import { ItemSelectionModel } from './ItemSelectionModel';
import {
  ClearAndSelect,
  NoUpdate,
  extendedSelectionCommand,
  isListKey,
  isNoUpdate,
  isSelectAllKey,
  moveCursor,
  rowRange,
} from './listSelection';

export const kDebugLabelHeaderHeight = 25;
export const kDebugLabelScrollBarWidth = 8;
const kItemMinimumWidth = 100;
const kDelayedAutoScrollMs = 600;

export class DebugLabelPanel {
  readonly color: QColor;
  private readonly m_title: string;
  private m_selected = new Set<string>();
  private m_headerText = '';
  private m_entries: DebugLabelEntry[] = [];
  private m_activated: ((ids: Set<string>, additive: boolean) => void) | null = null;

  private m_geometry = new QRect(0, 0, 0, 0);
  private m_visible = false;
  private m_font: FontSpec = fontWithPointSize(kDefaultFontFamily, 9);
  private m_measurer: TextMeasurer = approximateTextMeasurer;

  private readonly m_selection = new ItemSelectionModel();
  private m_currentRow = -1;
  private m_signalsBlocked = false;

  private m_currentSelectionStartRow = -1;
  private m_pressedRow = -1;
  private m_pressedContentY = 0;
  private m_noSelectionOnMousePress = false;
  private m_ctrlDragSelectionFlag: SelectionOp | null = null;
  private m_dragSelecting = false;
  private m_basePressActive = false;
  private m_delayedAutoScroll: ReturnType<typeof setTimeout> | null = null;
  private m_scroll = 0;

  private m_additive = false;
  private m_handlingInput = false;
  private m_rangePress = false;
  private m_rangeAnchor = -1;

  private readonly m_listeners = new Set<() => void>();
  private m_snapshot: DebugLabelPanelSnapshot | null = null;
  private m_parentUpdate: () => void = () => {};

  constructor(title: string, color: QColor) {
    this.m_title = title;
    this.color = color;
  }

  setActivatedCallback(callback: ((ids: Set<string>, additive: boolean) => void) | null): void {
    this.m_activated = callback;
  }

  setEntries(entries: readonly DebugLabelEntry[], selected: ReadonlySet<string>): void {
    const wasBlocked = this.m_signalsBlocked;
    this.m_signalsBlocked = true;
    if (!sameEntries(entries, this.m_entries)) {
      const scroll = this.m_scroll;
      this.m_entries = entries.map((entry) => ({ ...entry }));
      this.m_selection.clear();
      this.m_currentRow = -1;
      this.m_currentSelectionStartRow = -1;
      this.m_pressedRow = -1;
      this.m_rangeAnchor = -1;
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
      this.m_rangeAnchor = this.m_currentRow;
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

  selectedRowRect(id: string): QRect {
    if (!this.isVisible()) return new QRect();
    for (const row of this.m_selection.selectedRows()) {
      if (this.m_entries[row]?.id !== id) continue;
      const rect = this.visualItemRect(row).intersected(new QRect(0, 0, this.viewportWidth(), this.viewportHeight()));

      return rect.isEmpty()
        ? new QRect()
        : rect.translated(this.m_geometry.x, this.m_geometry.y + kDebugLabelHeaderHeight);
    }

    return new QRect();
  }

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

  setParentUpdate(update: () => void): void {
    this.m_parentUpdate = update;
  }

  dispose(): void {
    if (this.m_delayedAutoScroll !== null) clearTimeout(this.m_delayedAutoScroll);
    this.m_delayedAutoScroll = null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.m_listeners.add(listener);

    return () => {
      this.m_listeners.delete(listener);
    };
  };

  getSnapshot = (): DebugLabelPanelSnapshot => {
    this.m_snapshot ??= {
      title: this.m_title,
      headerText: this.m_headerText,
      visible: this.m_visible,
      geometry: this.m_geometry,
      font: this.m_font,
      color: this.color,
      rowHeight: this.rowHeight(),
      itemWidth: this.itemWidth(),
      scrollValue: this.m_scroll,
      rows: this.m_entries.map((_, row) => this.rowLayout(row)),
    };

    return this.m_snapshot;
  };

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

  rowHeight(): number {
    return Math.max(24, fontHeight(this.m_measurer, this.m_font) + 8);
  }

  viewportHeight(): number {
    return Math.max(0, this.m_geometry.height - kDebugLabelHeaderHeight);
  }

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

  setScrollValueFromView(value: number): void {
    this.setScrollValue(value);
  }

  isRowSelected(row: number): boolean {
    return this.m_selection.isSelected(row);
  }

  rowLayout(row: number): DebugLabelRowLayout {
    return labelRowLayout(this.m_entries[row], this.isRowSelected(row), this.itemWidth(), this.m_font, this.m_measurer);
  }

  mousePressEvent(x: number, y: number, button: number, modifiers: KeyboardModifiers): void {
    this.m_additive = modifiers.control || modifiers.shift;
    this.m_handlingInput = true;
    const index = this.indexAt(x, y);
    this.m_rangePress = button === LeftButton && modifiers.shift && this.m_rangeAnchor >= 0 && index >= 0;
    if (this.m_rangePress) {
      this.setCurrentIndex(index);
      this.select(
        rowRange(Math.min(this.m_rangeAnchor, index), Math.max(this.m_rangeAnchor, index)),
        modifiers.control ? { op: 'Select' } : ClearAndSelect,
      );
      this.m_basePressActive = false;
    } else {
      this.baseMousePressEvent(x, y, button, modifiers);
      this.m_rangeAnchor = index;
    }
    this.m_handlingInput = false;
    this.publishSelection();
  }

  mouseMoveEvent(x: number, y: number, buttons: number, modifiers: KeyboardModifiers): void {
    if (!(buttons & LeftButton) || !this.m_basePressActive) return;
    const index = this.indexAt(x, y);
    if (index < 0) return;
    this.m_dragSelecting = true;
    let command = this.selectionCommand(index, { type: 'move', modifiers });
    if (this.m_ctrlDragSelectionFlag !== null && command.op === 'Toggle')
      command = { ...command, op: this.m_ctrlDragSelectionFlag };
    this.setSelection(this.m_pressedContentY, y + this.m_scroll, command);
    if (index !== this.m_currentRow) this.setCurrentIndex(index);
  }

  mouseReleaseEvent(x: number, y: number, button: number, modifiers: KeyboardModifiers): void {
    if (this.m_rangePress) {
      this.m_rangePress = false;

      return;
    }
    const index = this.indexAt(x, y);
    if (this.m_noSelectionOnMousePress) {
      this.m_noSelectionOnMousePress = false;
      this.select(index >= 0 ? [index] : [], this.selectionCommand(index, { type: 'release', button, modifiers }));
    }
    this.m_dragSelecting = false;
    this.m_basePressActive = false;
  }

  keyPressEvent(key: string, modifiers: KeyboardModifiers): boolean {
    if (!isListKey(key, modifiers)) return false;
    this.m_additive = modifiers.control || modifiers.shift;
    this.m_handlingInput = true;
    this.baseKeyPressEvent(key, modifiers);
    this.m_handlingInput = false;
    this.publishSelection();

    return true;
  }

  private changed(): void {
    this.m_snapshot = null;
    for (const listener of [...this.m_listeners]) listener();
  }

  private maximumScroll(): number {
    return Math.max(0, this.m_entries.length * this.rowHeight() - this.viewportHeight());
  }

  private setScrollValue(value: number): void {
    const clamped = Math.min(Math.max(0, Math.round(value)), this.maximumScroll());
    if (clamped === this.m_scroll) return;
    this.m_scroll = clamped;
    this.changed();
    this.m_parentUpdate();
  }

  private visualItemRect(row: number): QRect {
    const h = this.rowHeight();

    return new QRect(0, row * h - this.m_scroll, this.itemWidth(), h);
  }

  private select(rows: readonly number[], command: SelectionCommand): void {
    if (this.m_selection.select(rows, command, this.m_entries.length)) this.itemSelectionChanged();
  }

  private setCurrentIndex(row: number, command: SelectionCommand = NoUpdate, autoScroll = true): void {
    if (!isNoUpdate(command)) this.select(row >= 0 ? [row] : [], command);
    if (row === this.m_currentRow) return;
    this.m_currentRow = row;
    if (row >= 0 && autoScroll && this.m_visible) this.scrollToItem(row);
    this.changed();
  }

  private itemSelectionChanged(): void {
    this.changed();
    if (this.m_signalsBlocked) return;
    if (!this.m_handlingInput) this.publishSelection();
  }

  private publishSelection(): void {
    const selected = new Set<string>();
    for (const row of this.m_selection.selectedRows()) selected.add(this.m_entries[row].id);
    if (this.m_activated) this.m_activated(selected, this.m_additive);
  }

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

  private indexAt(x: number, y: number): number {
    if (x < 0 || x >= this.viewportWidth() || y < 0 || y >= this.viewportHeight()) return -1;
    const row = Math.floor((y + this.m_scroll) / this.rowHeight());

    return row >= 0 && row < this.m_entries.length ? row : -1;
  }

  private setSelection(contentY1: number, contentY2: number, command: SelectionCommand): void {
    const h = this.rowHeight();
    const first = Math.max(0, Math.floor(Math.min(contentY1, contentY2) / h));
    const last = Math.min(this.m_entries.length - 1, Math.floor(Math.max(contentY1, contentY2) / h));
    this.select(rowRange(first, last), command);
  }

  private rowCenterContentY(row: number): number {
    const h = this.rowHeight();

    return row * h + Math.trunc((h - 1) / 2);
  }

  private selectionStartContentY(): number {
    return this.m_currentSelectionStartRow >= 0
      ? this.rowCenterContentY(this.m_currentSelectionStartRow)
      : this.m_scroll;
  }

  private selectionCommand(row: number, event: SelectionEvent): SelectionCommand {
    return extendedSelectionCommand(row, event, {
      rowSelected: this.isRowSelected(row),
      pressedRow: this.m_pressedRow,
      dragSelecting: this.m_dragSelecting,
    });
  }

  private baseMousePressEvent(x: number, y: number, button: number, modifiers: KeyboardModifiers): void {
    const index = this.indexAt(x, y);
    this.m_basePressActive = true;
    this.m_dragSelecting = false;
    this.m_ctrlDragSelectionFlag = null;
    this.m_pressedRow = index;
    let command = this.selectionCommand(index, { type: 'press', button, modifiers });
    this.m_noSelectionOnMousePress = isNoUpdate(command) || index < 0;
    const contentY = y + this.m_scroll;
    if (!command.current) {
      this.m_pressedContentY = contentY;
      this.m_currentSelectionStartRow = index;
    } else if (this.m_currentSelectionStartRow < 0) {
      this.m_currentSelectionStartRow = this.m_currentRow;
    }

    if (index < 0) {
      this.select([], { op: 'Select' });

      return;
    }
    this.setCurrentIndex(index, NoUpdate, false);
    if (command.op === 'Toggle') {
      this.m_ctrlDragSelectionFlag = this.isRowSelected(index) ? 'Deselect' : 'Select';
      command = { ...command, op: this.m_ctrlDragSelectionFlag };
    }
    this.setSelection(command.current ? this.selectionStartContentY() : contentY, contentY, command);
    if (this.m_delayedAutoScroll !== null) clearTimeout(this.m_delayedAutoScroll);
    this.m_delayedAutoScroll = setTimeout(() => {
      this.m_delayedAutoScroll = null;
      if (this.m_pressedRow >= 0) this.scrollToItem(this.m_pressedRow);
    }, kDelayedAutoScrollMs);
  }

  private baseKeyPressEvent(key: string, modifiers: KeyboardModifiers): void {
    if (isSelectAllKey(key, modifiers)) {
      this.select(
        this.m_entries.map((_, row) => row),
        ClearAndSelect,
      );

      return;
    }
    if (key === ' ') {
      if (this.m_currentRow >= 0) this.select([this.m_currentRow], { op: modifiers.control ? 'Toggle' : 'Select' });

      return;
    }
    const pageRows = Math.max(1, Math.floor(this.viewportHeight() / this.rowHeight()));
    const newCurrent = moveCursor(key, this.m_currentRow, this.m_entries.length, pageRows);
    const oldCurrent = this.m_currentRow;
    if (newCurrent === oldCurrent || newCurrent < 0) return;
    const command: SelectionCommand = modifiers.control
      ? NoUpdate
      : modifiers.shift
        ? { current: true, op: 'Select' }
        : ClearAndSelect;
    if (command.current) {
      this.setCurrentIndex(newCurrent);
      if (this.m_currentSelectionStartRow < 0) this.m_currentSelectionStartRow = oldCurrent;
      this.setSelection(this.selectionStartContentY(), this.rowCenterContentY(newCurrent), command);
    } else {
      this.setCurrentIndex(newCurrent, command);
      this.m_currentSelectionStartRow = newCurrent;
    }
  }
}

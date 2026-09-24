import type { SelectionCommand, Modifiers } from '../../types/qt';
import type { TreeKeyEvent, TreeMouseEvent, VisibleTreeRow } from '../../types/treeView';
import { Observable } from '../observable/Observable';
import { Signal } from './Signal';
import { TreeWidgetItem } from './TreeWidgetItem';

export const UserRole = 0x0100;

const kPageStep = 10;

export class TreeWidget extends Observable {
  readonly itemExpanded = new Signal<[TreeWidgetItem]>();
  readonly itemCollapsed = new Signal<[TreeWidgetItem]>();
  readonly itemClicked = new Signal<[TreeWidgetItem, number]>();
  readonly itemDoubleClicked = new Signal<[TreeWidgetItem, number]>();
  readonly itemSelectionChanged = new Signal<[]>();

  readonly #root: TreeWidgetItem;
  #signalsBlocked = false;
  #current: TreeWidgetItem | null = null;
  #rootItem: TreeWidgetItem | null = null;
  #selectionCounter = 0;
  #expandsOnDoubleClick = true;
  #headerLabels: string[] = [];
  readonly #columnWidths: number[] = [];
  readonly #resizeToContents = new Set<number>();

  #pressedItem: TreeWidgetItem | null = null;
  #noSelectionOnMousePress = false;
  #releaseFromDoubleClick = false;
  #currentSelectionStart: TreeWidgetItem | null = null;

  scrollRequest: { item: TreeWidgetItem; serial: number } | null = null;
  #scrollSerial = 0;

  constructor() {
    super();
    this.#root = TreeWidgetItem.createInvisibleRoot(this);
  }

  blockSignals(block: boolean): boolean {
    const previous = this.#signalsBlocked;
    this.#signalsBlocked = block;

    return previous;
  }

  signalsBlocked(): boolean {
    return this.#signalsBlocked;
  }

  protected emitSignal<Args extends unknown[]>(signal: Signal<Args>, ...args: Args): void {
    if (!this.#signalsBlocked) signal.emit(...args);
  }

  setColumnCount(count: number): void {
    this.#headerLabels.length = count;
    for (let c = 0; c < count; ++c) this.#headerLabels[c] ??= String(c + 1);
    this.changed();
  }

  columnCount(): number {
    return this.#headerLabels.length;
  }

  setHeaderLabels(labels: readonly string[]): void {
    this.#headerLabels = [...labels];
    this.changed();
  }

  headerLabels(): readonly string[] {
    return this.#headerLabels;
  }

  setColumnWidth(column: number, width: number): void {
    this.#columnWidths[column] = Math.max(0, Math.round(width));
    this.changed();
  }

  columnWidth(column: number): number {
    return this.#columnWidths[column] ?? 100;
  }

  setColumnResizeToContents(column: number, resize: boolean): void {
    if (resize) this.#resizeToContents.add(column);
    else this.#resizeToContents.delete(column);
    this.changed();
  }

  isColumnResizeToContents(column: number): boolean {
    return this.#resizeToContents.has(column);
  }

  setExpandsOnDoubleClick(enable: boolean): void {
    this.#expandsOnDoubleClick = enable;
  }

  invisibleRootItem(): TreeWidgetItem {
    return this.#root;
  }

  topLevelItemCount(): number {
    return this.#root.childCount();
  }

  topLevelItem(index: number): TreeWidgetItem {
    return this.#root.child(index);
  }

  clear(): void {
    for (const item of this.#root._takeChildren()) item._detach();
    this.#current = null;
    this.#rootItem = null;
    this.#pressedItem = null;
    this.#currentSelectionStart = null;
    this.scrollRequest = null;
    this.changed();
  }

  *allItems(): Generator<TreeWidgetItem> {
    let item = this.#root.childCount() ? this.#root.child(0) : null;
    while (item) {
      yield item;
      item = this.#nextItem(item);
    }
  }

  #nextItem(item: TreeWidgetItem): TreeWidgetItem | null {
    if (item.childCount()) return item.child(0);
    for (let current: TreeWidgetItem | null = item; current;) {
      const parent: TreeWidgetItem | null = current._rawParent();
      if (!parent) return null;
      const index = parent.indexOfChild(current);
      if (index + 1 < parent.childCount()) return parent.child(index + 1);
      if (parent === this.#root) return null;
      current = parent;
    }

    return null;
  }

  _itemsChanged(): void {
    this.changed();
  }

  setRootItem(item: TreeWidgetItem | null): void {
    this.#rootItem = item;
    this.changed();
  }

  rootItem(): TreeWidgetItem | null {
    return this.#rootItem;
  }

  visibleRows(): VisibleTreeRow[] {
    const rows: VisibleTreeRow[] = [];

    const visit = (parent: TreeWidgetItem, depth: number) => {
      for (const child of parent.children()) {
        if (child.isHidden()) continue;
        rows.push({ item: child, depth });
        if (child.isExpanded()) visit(child, depth + 1);
      }
    };

    visit(this.#rootItem ?? this.#root, 0);

    return rows;
  }

  isItemVisible(item: TreeWidgetItem | null): boolean {
    if (!item || item.treeWidget() !== this) return false;
    const root = this.#rootItem ?? this.#root;
    for (let current = item; ;) {
      if (current.isHidden()) return false;
      const parent = current._rawParent();
      if (!parent) return false;
      if (parent === root) return true;
      if (!parent.isExpanded()) return false;
      current = parent;
    }
  }

  scrollToItem(item: TreeWidgetItem | null): void {
    if (!item) return;
    this.scrollRequest = { item, serial: ++this.#scrollSerial };
    this.changed();
  }

  _setItemExpanded(item: TreeWidgetItem, expanded: boolean): void {
    if (item._expanded === expanded) return;
    item._expanded = expanded;
    this.changed();
    this.emitSignal(expanded ? this.itemExpanded : this.itemCollapsed, item);
  }

  currentItem(): TreeWidgetItem | null {
    return this.#current && this.#current.treeWidget() === this ? this.#current : null;
  }

  setCurrentItem(item: TreeWidgetItem | null, _column = 0, command: SelectionCommand = 'ClearAndSelect'): void {
    this.#trackSelection(() => {
      this.#current = item;
      if (command === 'NoUpdate') return;
      if (command === 'ClearAndSelect') this.#clearSelectionFlags();
      if (!item) return;
      if (command === 'Toggle') this.#setFlag(item, !item._selected);
      else this.#setFlag(item, true);
    });
    this.changed();
  }

  selectedItems(): TreeWidgetItem[] {
    const items: { item: TreeWidgetItem; order: number; position: number }[] = [];
    let position = 0;
    for (const item of this.allItems()) {
      if (item._selected && !item.isHidden()) items.push({ item, order: item._selectionOrder, position });
      ++position;
    }
    items.sort((a, b) => a.order - b.order || a.position - b.position);

    return items.map((entry) => entry.item);
  }

  clearSelection(): void {
    this.#trackSelection(() => this.#clearSelectionFlags());
    this.changed();
  }

  _setItemSelected(item: TreeWidgetItem, selected: boolean): void {
    this.#trackSelection(() => this.#setFlag(item, selected));
    this.changed();
  }

  #setFlag(item: TreeWidgetItem, selected: boolean): void {
    if (selected && !item._selected) item._selectionOrder = ++this.#selectionCounter;
    item._selected = selected;
  }

  #clearSelectionFlags(): void {
    for (const item of this.allItems()) item._selected = false;
  }

  #trackSelection(change: () => void): void {
    const before = new Set<TreeWidgetItem>();
    for (const item of this.allItems()) if (item._selected) before.add(item);
    change();
    let changed = false;
    let count = 0;
    for (const item of this.allItems()) {
      if (!item._selected) continue;
      ++count;
      if (!before.has(item)) changed = true;
    }
    if (count !== before.size) changed = true;
    if (changed) {
      this.changed();
      this.emitSignal(this.itemSelectionChanged);
    }
  }

  protected selectVisualRange(a: TreeWidgetItem, b: TreeWidgetItem, command: 'ClearAndSelect' | 'Select'): void {
    const rows = this.visibleRows().map((row) => row.item);
    let from = rows.indexOf(a);
    let to = rows.indexOf(b);
    if (from < 0 || to < 0) from = to = Math.max(rows.indexOf(b), 0);
    if (from > to) [from, to] = [to, from];
    this.#trackSelection(() => {
      if (command === 'ClearAndSelect') this.#clearSelectionFlags();
      for (let i = from; i <= to; ++i) if (rows[i]) this.#setFlag(rows[i], true);
    });
    this.changed();
  }

  protected setCurrentNoUpdate(item: TreeWidgetItem | null): void {
    this.#current = item;
    this.changed();
  }

  mousePressEvent(event: TreeMouseEvent): void {
    const { item, modifiers } = event;
    this.#releaseFromDoubleClick = false;
    if (item && event.onDecoration && item.hasChildIndicator()) {
      this.#pressedItem = null;
      item.setExpanded(!item.isExpanded());

      return;
    }
    this.#pressedItem = item;
    if (!item) {
      this.#noSelectionOnMousePress = true;

      return;
    }
    const command = this.#pressSelectionCommand(item, modifiers);
    this.#noSelectionOnMousePress = command === 'NoUpdate';
    if (command !== 'SelectCurrent') this.#currentSelectionStart = item;
    else if (!this.#currentSelectionStart || !this.isItemVisible(this.#currentSelectionStart))
      this.#currentSelectionStart = this.currentItem() ?? item;
    this.#current = item;
    if (command === 'SelectCurrent') this.selectVisualRange(this.#currentSelectionStart, item, 'ClearAndSelect');
    else if (command === 'Toggle') this._setItemSelected(item, !item._selected);
    else if (command === 'ClearAndSelect') this.setCurrentItem(item, event.column, 'ClearAndSelect');
    this.changed();
  }

  #pressSelectionCommand(item: TreeWidgetItem, modifiers: Modifiers): SelectionCommand {
    if (!modifiers.shift && !modifiers.control && item._selected) return 'NoUpdate';
    if (modifiers.shift) return 'SelectCurrent';
    if (modifiers.control) return 'Toggle';

    return 'ClearAndSelect';
  }

  mouseReleaseEvent(event: TreeMouseEvent): void {
    const { item, modifiers } = event;
    if (item && event.onDecoration && item.hasChildIndicator()) return;
    const click = !!item && item === this.#pressedItem && !this.#releaseFromDoubleClick;
    if (this.#noSelectionOnMousePress) {
      this.#noSelectionOnMousePress = false;
      const clearAndSelect =
        ((item && item === this.#pressedItem && item._selected) || !item) && !modifiers.shift && !modifiers.control;
      if (clearAndSelect) {
        if (item) {
          this.#trackSelection(() => {
            this.#clearSelectionFlags();
            this.#setFlag(item, true);
          });
        } else {
          this.clearSelection();
        }
      }
    }
    this.changed();
    if (click && item) this.emitSignal(this.itemClicked, item, event.column);
  }

  mouseDoubleClickEvent(event: TreeMouseEvent): void {
    const { item } = event;
    if (item && event.onDecoration && item.hasChildIndicator()) return;
    if (!item) return;
    if (this.#pressedItem !== item) {
      this.mousePressEvent(event);

      return;
    }
    this.emitSignal(this.itemDoubleClicked, item, event.column);
    this.#releaseFromDoubleClick = true;
    if (this.#expandsOnDoubleClick && item.hasChildIndicator()) item.setExpanded(!item.isExpanded());
  }

  keyPressEvent(event: TreeKeyEvent): boolean {
    const rows = this.visibleRows().map((row) => row.item);
    if (!rows.length) return false;
    const old = this.currentItem();
    const index = old ? rows.indexOf(old) : -1;
    let next: TreeWidgetItem;
    switch (event.key) {
      case 'ArrowUp':
        next = index < 0 ? rows[0] : rows[Math.max(index - 1, 0)];
        break;
      case 'ArrowDown':
        next = index < 0 ? rows[0] : rows[Math.min(index + 1, rows.length - 1)];
        break;
      case 'PageUp':
        next = rows[Math.max(index - kPageStep, 0)];
        break;
      case 'PageDown':
        next = rows[Math.min(Math.max(index, 0) + kPageStep, rows.length - 1)];
        break;
      case 'Home':
        next = rows[0];
        break;
      case 'End':
        next = rows[rows.length - 1];
        break;
      case 'ArrowRight':
        if (!old || index < 0) {
          next = rows[0];
          break;
        }
        if (old.hasChildIndicator() && !old.isExpanded()) {
          old.setExpanded(true);

          return true;
        }
        next =
          old.isExpanded() && index + 1 < rows.length && rows[index + 1]._rawParent() === old ? rows[index + 1] : old;
        break;
      case 'ArrowLeft': {
        if (!old || index < 0) {
          next = rows[0];
          break;
        }
        if (old.isExpanded() && old.hasChildIndicator()) {
          old.setExpanded(false);

          return true;
        }
        const parent = old.parent();
        next = parent && parent !== this.#rootItem && rows.includes(parent) ? parent : old;
        break;
      }
      case ' ':
        if (!old) return false;
        if (event.modifiers.control) this._setItemSelected(old, !old._selected);
        else this._setItemSelected(old, true);

        return true;
      default:
        return false;
    }
    if (next === old) return true;
    if (event.modifiers.control && !event.modifiers.shift) {
      this.setCurrentNoUpdate(next);
    } else if (event.modifiers.shift) {
      if (!this.#currentSelectionStart || !this.isItemVisible(this.#currentSelectionStart))
        this.#currentSelectionStart = old ?? next;
      this.#current = next;
      this.selectVisualRange(this.#currentSelectionStart, next, 'ClearAndSelect');
    } else {
      this.#currentSelectionStart = next;
      this.setCurrentItem(next, 0, 'ClearAndSelect');
    }
    this.scrollToItem(next);

    return true;
  }
}

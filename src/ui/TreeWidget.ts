// Port of the QTreeWidget / QTreeWidgetItem subset used by ApiTracePanel and
// ApiHistoryDialog, including the QTreeView/QAbstractItemView mouse and
// keyboard selection rules of QAbstractItemView::ExtendedSelection.
//
// Signals (itemExpanded, itemSelectionChanged, ...) are emitted synchronously
// from the mutating call unless blockSignals(true) is active, exactly like
// Qt. Programmatic setExpanded()/setSelected()/setCurrentItem() therefore
// behave as in the C++ code, including under QSignalBlocker.
//
// Selection is item-based (QAbstractItemView::SelectRows).

import { Observable, type Modifiers } from './Observable';

/** Qt::UserRole */
export const UserRole = 0x0100;

export type ChildIndicatorPolicy = 'ShowIndicator' | 'DontShowIndicator' | 'DontShowIndicatorWhenChildless';
export type SelectionCommand = 'NoUpdate' | 'ClearAndSelect' | 'Select' | 'Toggle' | 'SelectCurrent';

const kInvisibleRoot = Symbol('invisibleRootItem');

export class Signal<Args extends unknown[]> {
  readonly #slots: ((...args: Args) => void)[] = [];
  connect(slot: (...args: Args) => void): void { this.#slots.push(slot); }
  /** Called by the owner, which checks QObject::signalsBlocked(). */
  emit(...args: Args): void { for (const slot of [...this.#slots]) slot(...args); }
}

export class TreeWidgetItem {
  #tree: TreeWidget | null;
  #parent: TreeWidgetItem | null;
  readonly #children: TreeWidgetItem[] = [];
  readonly #texts: string[] = [];
  readonly #data = new Map<string, unknown>();
  readonly #bold = new Set<number>();
  readonly #foreground = new Map<number, string>();
  #policy: ChildIndicatorPolicy = 'DontShowIndicatorWhenChildless';
  /** @internal state kept by the owning TreeWidget */
  _expanded = false;
  /** @internal */
  _selected = false;
  /** @internal selection insertion order (QItemSelection range order) */
  _selectionOrder = 0;
  /** @internal */
  _hidden = false;

  /** new QTreeWidgetItem(parentItem) or new QTreeWidgetItem(treeWidget). */
  constructor(parent: TreeWidgetItem | TreeWidget, invisibleRootOf?: typeof kInvisibleRoot) {
    if (invisibleRootOf === kInvisibleRoot) {
      // QTreeWidget::invisibleRootItem() of `parent`.
      this.#tree = parent as TreeWidget;
      this.#parent = null;
      return;
    }
    const parentItem = parent instanceof TreeWidget ? parent.invisibleRootItem() : parent;
    this.#tree = parentItem.#tree;
    this.#parent = parentItem;
    parentItem.#children.push(this);
    this.#tree?._itemsChanged();
  }

  /** QTreeWidgetItem::parent(): nullptr for top-level items. */
  parent(): TreeWidgetItem | null {
    const parent = this.#parent;
    if (!parent || !this.#tree || parent === this.#tree.invisibleRootItem()) return null;
    return parent;
  }
  /** @internal parent including the invisible root. */
  _rawParent(): TreeWidgetItem | null { return this.#parent; }
  treeWidget(): TreeWidget | null { return this.#tree; }

  childCount(): number { return this.#children.length; }
  child(index: number): TreeWidgetItem { return this.#children[index]; }
  children(): readonly TreeWidgetItem[] { return this.#children; }
  indexOfChild(child: TreeWidgetItem): number { return this.#children.indexOf(child); }

  text(column: number): string { return this.#texts[column] ?? ''; }
  setText(column: number, text: string): void {
    if (this.#texts[column] === text) return;
    this.#texts[column] = text;
    this.#tree?._itemsChanged();
  }

  /** QTreeWidgetItem::data(column, role); undefined is an invalid QVariant. */
  data(column: number, role: number): unknown { return this.#data.get(`${column}:${role}`); }
  setData(column: number, role: number, value: unknown): void {
    this.#data.set(`${column}:${role}`, value);
    this.#tree?._itemsChanged();
  }
  /** data(column, role).toString() */
  dataString(column: number, role: number): string {
    const value = this.data(column, role);
    return value === undefined || value === null ? '' : String(value);
  }
  /** data(column, role).toInt() */
  dataInt(column: number, role: number): number {
    const value = this.data(column, role);
    if (typeof value === 'number') return Math.trunc(value);
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && /^\s*[+-]?\d+\s*$/.test(value)) return Number.parseInt(value, 10);
    return 0;
  }
  /** data(column, role).isValid() */
  hasData(column: number, role: number): boolean { return this.#data.has(`${column}:${role}`); }

  isBold(column: number): boolean { return this.#bold.has(column); }
  /** QFont font = item->font(column); font.setBold(bold); item->setFont(column, font); */
  setBold(column: number, bold: boolean): void {
    if (bold === this.#bold.has(column)) return;
    if (bold) this.#bold.add(column); else this.#bold.delete(column);
    this.#tree?._itemsChanged();
  }
  foreground(column: number): string | undefined { return this.#foreground.get(column); }
  /** setForeground(column, QBrush(color)); undefined is the default QBrush(). */
  setForeground(column: number, color: string | undefined): void {
    if (this.#foreground.get(column) === color) return;
    if (color === undefined) this.#foreground.delete(column); else this.#foreground.set(column, color);
    this.#tree?._itemsChanged();
  }

  childIndicatorPolicy(): ChildIndicatorPolicy { return this.#policy; }
  setChildIndicatorPolicy(policy: ChildIndicatorPolicy): void {
    this.#policy = policy;
    this.#tree?._itemsChanged();
  }
  /** Whether the branch indicator is drawn (QTreeModel::hasChildren). */
  hasChildIndicator(): boolean {
    if (this.#policy === 'ShowIndicator') return true;
    if (this.#policy === 'DontShowIndicator') return false;
    return this.#children.length > 0;
  }

  isExpanded(): boolean { return this._expanded; }
  setExpanded(expanded: boolean): void { this.#tree?._setItemExpanded(this, expanded); }
  isSelected(): boolean { return this._selected; }
  setSelected(selected: boolean): void { this.#tree?._setItemSelected(this, selected); }
  isHidden(): boolean { return this._hidden; }
  setHidden(hidden: boolean): void {
    if (this._hidden === hidden) return;
    this._hidden = hidden;
    this.#tree?._itemsChanged();
  }

  /** @internal detaches this subtree when the tree is cleared. */
  _detach(): void {
    this.#tree = null;
    for (const child of this.#children) child._detach();
  }
  /** @internal removes every child (QTreeWidget::clear on the invisible root). */
  _takeChildren(): TreeWidgetItem[] { return this.#children.splice(0); }
}

export interface TreeMouseEvent {
  item: TreeWidgetItem | null;
  column: number;
  modifiers: Modifiers;
  /** The press/release hit the branch indicator of `item`. */
  onDecoration: boolean;
}

export interface TreeKeyEvent {
  key: string;
  modifiers: Modifiers;
}

export interface VisibleTreeRow {
  item: TreeWidgetItem;
  depth: number;
}

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

  // QAbstractItemViewPrivate mouse state
  #pressedItem: TreeWidgetItem | null = null;
  #noSelectionOnMousePress = false;
  #releaseFromDoubleClick = false;
  #currentSelectionStart: TreeWidgetItem | null = null;

  /** Pending QAbstractItemView::scrollTo(); consumed by the view. */
  scrollRequest: { item: TreeWidgetItem; serial: number } | null = null;
  #scrollSerial = 0;

  constructor() {
    super();
    this.#root = new TreeWidgetItem(this, kInvisibleRoot);
  }

  // --- QObject -----------------------------------------------------------
  blockSignals(block: boolean): boolean {
    const previous = this.#signalsBlocked;
    this.#signalsBlocked = block;
    return previous;
  }
  signalsBlocked(): boolean { return this.#signalsBlocked; }

  /** Emit `signal` unless signals are blocked. */
  protected emitSignal<Args extends unknown[]>(signal: Signal<Args>, ...args: Args): void {
    if (!this.#signalsBlocked) signal.emit(...args);
  }

  // --- header -----------------------------------------------------------
  setColumnCount(count: number): void {
    this.#headerLabels.length = count;
    for (let c = 0; c < count; ++c) this.#headerLabels[c] ??= String(c + 1);
    this.changed();
  }
  columnCount(): number { return this.#headerLabels.length; }
  setHeaderLabels(labels: readonly string[]): void {
    this.#headerLabels = [...labels];
    this.changed();
  }
  headerLabels(): readonly string[] { return this.#headerLabels; }
  setColumnWidth(column: number, width: number): void {
    this.#columnWidths[column] = Math.max(0, Math.round(width));
    this.changed();
  }
  columnWidth(column: number): number { return this.#columnWidths[column] ?? 100; }
  /** header()->setSectionResizeMode(column, QHeaderView::ResizeToContents) */
  setColumnResizeToContents(column: number, resize: boolean): void {
    if (resize) this.#resizeToContents.add(column); else this.#resizeToContents.delete(column);
    this.changed();
  }
  isColumnResizeToContents(column: number): boolean { return this.#resizeToContents.has(column); }
  setExpandsOnDoubleClick(enable: boolean): void { this.#expandsOnDoubleClick = enable; }

  // --- items ---------------------------------------------------------------
  invisibleRootItem(): TreeWidgetItem { return this.#root; }
  topLevelItemCount(): number { return this.#root.childCount(); }
  topLevelItem(index: number): TreeWidgetItem { return this.#root.child(index); }

  /** QTreeWidget::clear() */
  clear(): void {
    for (const item of this.#root._takeChildren()) item._detach();
    this.#current = null;
    this.#rootItem = null;
    this.#pressedItem = null;
    this.#currentSelectionStart = null;
    this.scrollRequest = null;
    this.changed();
  }

  /**
   * QTreeWidgetItemIterator(tree): pre-order over every item, hidden ones
   * included. The next item is computed lazily, so children added to the
   * current item while iterating are visited, as in Qt.
   */
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

  /** @internal */
  _itemsChanged(): void { this.changed(); }

  // --- root index ------------------------------------------------------------
  /** QTreeView::setRootIndex(indexFromItem(item)); null is the invisible root. */
  setRootItem(item: TreeWidgetItem | null): void {
    this.#rootItem = item;
    this.changed();
  }
  rootItem(): TreeWidgetItem | null { return this.#rootItem; }

  /** Rows the view shows: below the root index, not hidden, inside expanded branches. */
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

  /** QAbstractItemView::visualRect(index) is non-empty. */
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

  // --- expansion -------------------------------------------------------------
  /** @internal QTreeView::expand()/collapse(): emit expanded/collapsed. */
  _setItemExpanded(item: TreeWidgetItem, expanded: boolean): void {
    if (item._expanded === expanded) return;
    item._expanded = expanded;
    this.changed();
    this.emitSignal(expanded ? this.itemExpanded : this.itemCollapsed, item);
  }

  // --- selection -------------------------------------------------------------
  currentItem(): TreeWidgetItem | null {
    return this.#current && this.#current.treeWidget() === this ? this.#current : null;
  }

  /**
   * QTreeWidget::setCurrentItem(item, column, command). Without a command the
   * view's default (ClearAndSelect for ExtendedSelection) applies.
   */
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

  /**
   * QTreeWidget::selectedItems(): selected items that are not hidden, in the
   * order they were selected (QItemSelection range order).
   */
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

  /** @internal QTreeWidgetItem::setSelected() */
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

  /** Apply a selection change and emit itemSelectionChanged if it changed. */
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

  /** QAbstractItemView::setSelection(rect, command | Rows) over the visual rows between a and b. */
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

  /** Set the current item without changing the selection (QItemSelectionModel::NoUpdate). */
  protected setCurrentNoUpdate(item: TreeWidgetItem | null): void {
    this.#current = item;
    this.changed();
  }

  // --- mouse (QTreeView / QAbstractItemView, ExtendedSelection) -------------------
  mousePressEvent(event: TreeMouseEvent): void {
    const { item, modifiers } = event;
    this.#releaseFromDoubleClick = false;
    if (item && event.onDecoration && item.hasChildIndicator()) {
      // QTreeViewPrivate::expandOrCollapseItemAtPos(): toggles on press and
      // leaves the selection unchanged.
      this.#pressedItem = null;
      item.setExpanded(!item.isExpanded());
      return;
    }
    this.#pressedItem = item;
    if (!item) {
      // Pressing the empty area selects nothing now; the release clears.
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
    // QAbstractItemViewPrivate::extendedSelectionCommand() for MouseButtonPress
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
      // ClearAndSelect on release after pressing an already selected item or the empty area.
      const clearAndSelect = ((item && item === this.#pressedItem && item._selected) || !item)
        && !modifiers.shift && !modifiers.control;
      if (clearAndSelect) {
        if (item) {
          this.#trackSelection(() => { this.#clearSelectionFlags(); this.#setFlag(item, true); });
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

  // --- keyboard (QTreeView::moveCursor + QAbstractItemView::keyPressEvent) -------
  keyPressEvent(event: TreeKeyEvent): boolean {
    const rows = this.visibleRows().map((row) => row.item);
    if (!rows.length) return false;
    const old = this.currentItem();
    const index = old ? rows.indexOf(old) : -1;
    let next: TreeWidgetItem | null = null;
    switch (event.key) {
      case 'ArrowUp': next = index < 0 ? rows[0] : rows[Math.max(index - 1, 0)]; break;
      case 'ArrowDown': next = index < 0 ? rows[0] : rows[Math.min(index + 1, rows.length - 1)]; break;
      case 'PageUp': next = rows[Math.max(index - kPageStep, 0)]; break;
      case 'PageDown': next = rows[Math.min(Math.max(index, 0) + kPageStep, rows.length - 1)]; break;
      case 'Home': next = rows[0]; break;
      case 'End': next = rows[rows.length - 1]; break;
      case 'ArrowRight':
        if (!old || index < 0) { next = rows[0]; break; }
        if (old.hasChildIndicator() && !old.isExpanded()) { old.setExpanded(true); return true; }
        next = old.isExpanded() && index + 1 < rows.length && rows[index + 1]._rawParent() === old ? rows[index + 1] : old;
        break;
      case 'ArrowLeft': {
        if (!old || index < 0) { next = rows[0]; break; }
        if (old.isExpanded() && old.hasChildIndicator()) { old.setExpanded(false); return true; }
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
    if (!next || next === old) return true;
    if (event.modifiers.control && !event.modifiers.shift) {
      this.setCurrentNoUpdate(next);
    } else if (event.modifiers.shift) {
      if (!this.#currentSelectionStart || !this.isItemVisible(this.#currentSelectionStart)) this.#currentSelectionStart = old ?? next;
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

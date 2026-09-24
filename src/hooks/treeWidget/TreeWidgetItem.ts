import type { ChildIndicatorPolicy } from '../../types/qt';
import type { TreeWidget } from './TreeWidget';

const kInvisibleRoot = Symbol('invisibleRootItem');
let nextItemId = 1;

export class TreeWidgetItem {
  readonly id: number;
  #tree: TreeWidget | null;
  #parent: TreeWidgetItem | null;
  readonly #children: TreeWidgetItem[] = [];
  readonly #texts: string[] = [];
  readonly #data = new Map<string, unknown>();
  readonly #bold = new Set<number>();
  readonly #foreground = new Map<number, string>();
  #policy: ChildIndicatorPolicy = 'DontShowIndicatorWhenChildless';
  _expanded = false;
  _selected = false;
  _selectionOrder = 0;
  _hidden = false;

  constructor(parent: TreeWidgetItem | TreeWidget, invisibleRootOf?: typeof kInvisibleRoot) {
    this.id = nextItemId++;
    if (invisibleRootOf === kInvisibleRoot) {
      this.#tree = parent as TreeWidget;
      this.#parent = null;
      return;
    }
    const parentItem = parent instanceof TreeWidgetItem ? parent : parent.invisibleRootItem();
    this.#tree = parentItem.#tree;
    this.#parent = parentItem;
    parentItem.#children.push(this);
    this.#tree?._itemsChanged();
  }

  static createInvisibleRoot(tree: TreeWidget): TreeWidgetItem {
    return new TreeWidgetItem(tree, kInvisibleRoot);
  }

  parent(): TreeWidgetItem | null {
    const parent = this.#parent;
    if (!parent || !this.#tree || parent === this.#tree.invisibleRootItem()) return null;
    return parent;
  }
  _rawParent(): TreeWidgetItem | null {
    return this.#parent;
  }
  treeWidget(): TreeWidget | null {
    return this.#tree;
  }

  childCount(): number {
    return this.#children.length;
  }
  child(index: number): TreeWidgetItem {
    return this.#children[index];
  }
  children(): readonly TreeWidgetItem[] {
    return this.#children;
  }
  indexOfChild(child: TreeWidgetItem): number {
    return this.#children.indexOf(child);
  }

  text(column: number): string {
    return this.#texts[column] ?? '';
  }
  setText(column: number, text: string): void {
    if (this.#texts[column] === text) return;
    this.#texts[column] = text;
    this.#tree?._itemsChanged();
  }

  data(column: number, role: number): unknown {
    return this.#data.get(`${column}:${role}`);
  }
  setData(column: number, role: number, value: unknown): void {
    this.#data.set(`${column}:${role}`, value);
    this.#tree?._itemsChanged();
  }
  dataString(column: number, role: number): string {
    const value = this.data(column, role);
    return value === undefined || value === null ? '' : String(value);
  }
  dataInt(column: number, role: number): number {
    const value = this.data(column, role);
    if (typeof value === 'number') return Math.trunc(value);
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string' && /^\s*[+-]?\d+\s*$/.test(value)) return Number.parseInt(value, 10);
    return 0;
  }
  hasData(column: number, role: number): boolean {
    return this.#data.has(`${column}:${role}`);
  }

  isBold(column: number): boolean {
    return this.#bold.has(column);
  }
  setBold(column: number, bold: boolean): void {
    if (bold === this.#bold.has(column)) return;
    if (bold) this.#bold.add(column);
    else this.#bold.delete(column);
    this.#tree?._itemsChanged();
  }
  foreground(column: number): string | undefined {
    return this.#foreground.get(column);
  }
  setForeground(column: number, color: string | undefined): void {
    if (this.#foreground.get(column) === color) return;
    if (color === undefined) this.#foreground.delete(column);
    else this.#foreground.set(column, color);
    this.#tree?._itemsChanged();
  }

  childIndicatorPolicy(): ChildIndicatorPolicy {
    return this.#policy;
  }
  setChildIndicatorPolicy(policy: ChildIndicatorPolicy): void {
    this.#policy = policy;
    this.#tree?._itemsChanged();
  }
  hasChildIndicator(): boolean {
    if (this.#policy === 'ShowIndicator') return true;
    if (this.#policy === 'DontShowIndicator') return false;
    return this.#children.length > 0;
  }

  isExpanded(): boolean {
    return this._expanded;
  }
  setExpanded(expanded: boolean): void {
    this.#tree?._setItemExpanded(this, expanded);
  }
  isSelected(): boolean {
    return this._selected;
  }
  setSelected(selected: boolean): void {
    this.#tree?._setItemSelected(this, selected);
  }
  isHidden(): boolean {
    return this._hidden;
  }
  setHidden(hidden: boolean): void {
    if (this._hidden === hidden) return;
    this._hidden = hidden;
    this.#tree?._itemsChanged();
  }

  _detach(): void {
    this.#tree = null;
    for (const child of this.#children) child._detach();
  }
  _takeChildren(): TreeWidgetItem[] {
    return this.#children.splice(0);
  }
}

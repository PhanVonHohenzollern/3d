import type { TreeWidgetItem } from '../hooks/treeWidget/TreeWidgetItem';
import type { Modifiers } from './qt';

export interface TreeMouseEvent {
  item: TreeWidgetItem | null;
  column: number;
  modifiers: Modifiers;
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

export interface TreeCellView {
  text: string;
  width: number;
  bold: boolean;
  color: string | undefined;
  indent: number;
}

export interface TreeRowView {
  key: number;
  index: number;
  depth: number;
  selected: boolean;
  current: boolean;
  hasIndicator: boolean;
  expanded: boolean;
  branchLeft: number;
  cells: TreeCellView[];
}

export interface TreeColumnView {
  label: string;
  width: number;
  resizable: boolean;
}

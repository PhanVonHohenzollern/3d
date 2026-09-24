import type { TreeCellView } from '../types/treeView';

const kCellPadding = 12;

export type MeasureText = (text: string, bold: boolean) => number;

export function resizeToContentsWidth(
  label: string,
  cells: readonly Pick<TreeCellView, 'text' | 'bold' | 'indent'>[],
  measure: MeasureText,
): number {
  let width = measure(label, false) + kCellPadding + 8;
  for (const cell of cells) width = Math.max(width, cell.indent + measure(cell.text, cell.bold) + kCellPadding);
  return Math.ceil(width);
}

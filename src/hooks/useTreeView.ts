import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { eventModifiers } from '../helpers/keyboard';
import { kTreeIndentation } from '../helpers/layout';
import { resizeToContentsWidth } from '../helpers/treeColumns';
import type { TreeColumnView, TreeMouseEvent, TreeRowView } from '../types/treeView';
import { textWidth } from '../utils/measureText';
import type { TreeWidget } from './treeWidget/TreeWidget';
import { usePointerDrag } from './usePointerDrag';
import { useObservable } from './useObservable';

export function useTreeView(tree: TreeWidget) {
  useObservable(tree);
  const containerRef = useRef<HTMLDivElement>(null);
  const startDrag = usePointerDrag();
  const visible = tree.visibleRows();
  const current = tree.currentItem();
  const labels = tree.headerLabels();

  const rows: TreeRowView[] = visible.map(({ item, depth }, index) => ({
    key: item.id,
    index,
    depth,
    selected: item.isSelected(),
    current: item === current,
    hasIndicator: item.hasChildIndicator(),
    expanded: item.isExpanded(),
    branchLeft: depth * kTreeIndentation,
    cells: labels.map((_, column) => ({
      text: item.text(column),
      width: 0,
      bold: item.isBold(column),
      color: item.foreground(column),
      indent: column === 0 ? (depth + 1) * kTreeIndentation : 0,
    })),
  }));

  const columns: TreeColumnView[] = labels.map((label, column) => {
    const resizeToContents = tree.isColumnResizeToContents(column);
    const width = resizeToContents
      ? resizeToContentsWidth(
          label,
          rows.map((row) => row.cells[column]),
          textWidth,
        )
      : tree.columnWidth(column);

    return { label, width, resizable: !resizeToContents };
  });
  for (const row of rows) row.cells.forEach((cell, column) => (cell.width = columns[column].width));
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  const scrollSerial = tree.scrollRequest?.serial;
  useLayoutEffect(() => {
    const request = tree.scrollRequest;
    if (!request) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-key="${request.item.id}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [scrollSerial, tree]);

  const hit = (event: MouseEvent): TreeMouseEvent => {
    const target = event.target as Element;
    const rowElement = target.closest<HTMLElement>('[data-row]');
    const row = rowElement ? visible[Number(rowElement.dataset.row)] : undefined;
    const cell = target.closest<HTMLElement>('[data-column]');

    return {
      item: row?.item ?? null,
      column: cell ? Number(cell.dataset.column) : 0,
      modifiers: eventModifiers(event),
      onDecoration: !!target.closest('[data-branch]'),
    };
  };

  const inHeader = (event: MouseEvent) => !!(event.target as Element).closest('[data-tree-header]');

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || inHeader(event)) return;
    containerRef.current?.focus({ preventScroll: true });
    event.preventDefault();
    if (event.detail === 2) tree.mouseDoubleClickEvent(hit(event));
    else tree.mousePressEvent(hit(event));
  };

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || inHeader(event)) return;
    tree.mouseReleaseEvent(hit(event));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== containerRef.current || event.altKey) return;
    if (tree.keyPressEvent({ key: event.key, modifiers: eventModifiers(event) })) event.preventDefault();
  };

  const onResizeStart = (column: number) => (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const startWidth = tree.columnWidth(column);
    startDrag(event, (dx) => tree.setColumnWidth(column, Math.max(startWidth + dx, 8)));
  };

  return { containerRef, columns, rows, totalWidth, onMouseDown, onMouseUp, onKeyDown, onResizeStart };
}

import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { eventModifiers } from '../helpers/keyboard';
import { kTreeIndentation } from '../helpers/layout';
import { resizeToContentsWidth } from '../helpers/treeColumns';
import type { TreeColumnView, TreeMouseEvent, TreeRowView } from '../types/treeView';
import { textWidth } from '../utils/measureText';
import { isOnScrollbar } from '../utils/dom';
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
  const firstWidth = Math.min(96, Math.max(48, ...rows.map((row) => row.cells[0].indent + 12)));
  const remainingWidth = Math.max(1, totalWidth - (columns[0]?.width ?? 0));
  const fittedWidths = columns.map((column, index) =>
    index === 0
      ? `${firstWidth}px`
      : `calc(${(column.width / remainingWidth) * 100}% - ${(column.width / remainingWidth) * firstWidth}px)`,
  );
  for (const row of rows) {
    row.branchLeft = Math.min(row.branchLeft, firstWidth - 24);
    row.cells[0].indent = Math.min(row.cells[0].indent, firstWidth - 12);
  }

  const scrollRequest = tree.scrollRequest;
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !scrollRequest) return;

    const scrollToSelection = () => {
      const row = container.querySelector<HTMLElement>(`[data-key="${scrollRequest.item.id}"]`);
      if (!row || !container.clientHeight) return;
      const top = row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      const bottom = top + row.offsetHeight;
      // Keep the selected call below the sticky header without scrolling the whole page.
      if (top < container.scrollTop + 28) container.scrollTop = top - 28;
      else if (bottom > container.scrollTop + container.clientHeight)
        container.scrollTop = bottom - container.clientHeight;
    };

    scrollToSelection();
    const observer = new ResizeObserver(scrollToSelection);
    observer.observe(container);

    return () => observer.disconnect();
  }, [scrollRequest]);

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
    if (event.button !== 0 || inHeader(event) || isOnScrollbar(event)) return;
    containerRef.current?.focus({ preventScroll: true });
    event.preventDefault();
    if (event.detail === 2) tree.mouseDoubleClickEvent(hit(event));
    else tree.mousePressEvent(hit(event));
  };

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || inHeader(event) || isOnScrollbar(event)) return;
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

  return {
    containerRef,
    columns,
    rows,
    fittedWidths,
    onMouseDown,
    onMouseUp,
    onKeyDown,
    onResizeStart,
  };
}

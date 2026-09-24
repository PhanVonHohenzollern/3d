// Renders a TreeWidget model like QTreeView: interactive header, indented
// rows with branch indicators, selection and current item. Mouse and keyboard
// events are forwarded to the model's QTreeView/QAbstractItemView handlers.

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { eventModifiers, useObservable } from './Observable';
import type { TreeMouseEvent, TreeWidget, TreeWidgetItem } from './TreeWidget';
import './ItemViews.css';

/** QTreeView::indentation() */
const kIndentation = 20;
const kCellPadding = 12;

const itemKeys = new WeakMap<TreeWidgetItem, number>();
let nextItemKey = 1;
function itemKey(item: TreeWidgetItem): number {
  let key = itemKeys.get(item);
  if (key === undefined) itemKeys.set(item, (key = nextItemKey++));
  return key;
}

let measureContext: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  if (!text) return 0;
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * 7;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

export interface TreeViewProps {
  tree: TreeWidget;
  className?: string;
}

export function TreeView({ tree, className }: TreeViewProps) {
  useObservable(tree);
  const containerRef = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState('13px sans-serif');
  const rows = tree.visibleRows();
  const labels = tree.headerLabels();
  const current = tree.currentItem();

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    // The computed `font` shorthand is empty in some browsers; compose it.
    const style = getComputedStyle(containerRef.current);
    setFont(`${style.fontSize} ${style.fontFamily}`);
  }, []);

  // QHeaderView::ResizeToContents
  const widths = labels.map((label, column) => {
    if (!tree.isColumnResizeToContents(column)) return tree.columnWidth(column);
    let width = textWidth(label, font) + kCellPadding + 8;
    for (const row of rows) {
      const indent = column === 0 ? (row.depth + 1) * kIndentation : 0;
      const bold = row.item.isBold(column) ? `bold ${font}` : font;
      width = Math.max(width, indent + textWidth(row.item.text(column), bold) + kCellPadding);
    }
    return Math.ceil(width);
  });
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  // QAbstractItemView::scrollTo(index, EnsureVisible)
  const scrollSerial = tree.scrollRequest?.serial;
  useLayoutEffect(() => {
    const request = tree.scrollRequest;
    const container = containerRef.current;
    if (!request || !container) return;
    const element = container.querySelector<HTMLElement>(`[data-key="${itemKey(request.item)}"]`);
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [scrollSerial, tree]);

  const hit = (event: MouseEvent): TreeMouseEvent => {
    const target = event.target as Element;
    const rowElement = target.closest<HTMLElement>('[data-row]');
    const row = rowElement ? rows[Number(rowElement.dataset.row)] : undefined;
    const cell = target.closest<HTMLElement>('[data-column]');
    return {
      item: row?.item ?? null,
      column: cell ? Number(cell.dataset.column) : 0,
      modifiers: eventModifiers(event),
      onDecoration: !!target.closest('.tree-branch'),
    };
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || (event.target as Element).closest('.tree-header')) return;
    containerRef.current?.focus({ preventScroll: true });
    event.preventDefault();
    if (event.detail === 2) tree.mouseDoubleClickEvent(hit(event));
    else tree.mousePressEvent(hit(event));
  };
  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || (event.target as Element).closest('.tree-header')) return;
    tree.mouseReleaseEvent(hit(event));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== containerRef.current || event.altKey) return;
    if (tree.keyPressEvent({ key: event.key, modifiers: eventModifiers(event) })) event.preventDefault();
  };

  const onResizeStart = (column: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = tree.columnWidth(column);
    const move = (e: PointerEvent) => tree.setColumnWidth(column, Math.max(startWidth + e.clientX - startX, 8));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  return (
    <div
      ref={containerRef}
      className={`tree-view${className ? ` ${className}` : ''}`}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
    >
      <div className="tree-content" style={{ width: totalWidth }}>
        <div className="tree-header item-header">
          {labels.map((label, column) => (
            <div key={column} className="item-header-section" style={{ width: widths[column] }}>
              <span className="item-header-label">{label}</span>
              {!tree.isColumnResizeToContents(column) && (
                <div className="item-header-resize" onPointerDown={onResizeStart(column)} />
              )}
            </div>
          ))}
        </div>
        {rows.map((row, index) => {
          const item = row.item;
          const classes = ['tree-row'];
          if (item.isSelected()) classes.push('selected');
          if (item === current) classes.push('current');
          return (
            <div key={itemKey(item)} data-key={itemKey(item)} data-row={index} className={classes.join(' ')}>
              {widths.map((width, column) => {
                const style: CSSProperties = { width };
                const color = item.foreground(column);
                if (color) style.color = color;
                if (item.isBold(column)) style.fontWeight = 'bold';
                if (column === 0) style.paddingLeft = (row.depth + 1) * kIndentation;
                return (
                  <div key={column} data-column={column} className="tree-cell" style={style}>
                    {column === 0 && item.hasChildIndicator() && (
                      <span
                        className={`tree-branch${item.isExpanded() ? ' open' : ''}`}
                        style={{ left: row.depth * kIndentation, width: kIndentation }}
                      />
                    )}
                    {item.text(column)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

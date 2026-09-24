import { useTreeView } from '../hooks/useTreeView';
import type { TreeWidget } from '../hooks/treeWidget/TreeWidget';
import { cn } from '../utils/cn';

interface TreeViewProps {
  tree: TreeWidget;
  variant?: 'default' | 'trace';
}

export function TreeView({ tree, variant = 'default' }: TreeViewProps) {
  const { containerRef, columns, rows, totalWidth, onMouseDown, onMouseUp, onKeyDown, onResizeStart } =
    useTreeView(tree);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="group/tree relative min-h-0 flex-1 overflow-auto bg-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
    >
      <div className="min-w-full" style={{ width: totalWidth }}>
        <div data-tree-header className="sticky top-0 z-1 flex w-full">
          {columns.map((column, index) => (
            <div
              key={index}
              className="relative h-9 flex-none overflow-hidden border-b border-line bg-window px-2 text-left text-[11px] leading-9 font-medium text-ellipsis whitespace-nowrap text-muted-foreground last:flex-[1_0_auto]"
              style={{ width: column.width }}
            >
              <span>{column.label}</span>
              {column.resizable && (
                <div
                  className="absolute top-0 -right-[3px] z-2 h-full w-[7px] cursor-col-resize touch-none"
                  onPointerDown={onResizeStart(index)}
                />
              )}
            </div>
          ))}
        </div>
        {rows.length === 0 && (
          <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 px-6 py-6 text-center text-xs text-muted-foreground">
            <span className="font-medium text-foreground">No API calls yet</span>
            <span className="max-w-sm leading-relaxed">
              Add a geometry API call, then move the cursor below it to inspect its inputs and results.
            </span>
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.key}
            data-key={row.key}
            data-row={row.index}
            className={cn(
              'flex h-9 cursor-default scroll-mt-9 border-b border-grid text-xs leading-9 tabular-nums',
              !row.selected && 'hover:bg-secondary/50',
              row.selected &&
                (variant === 'trace' ? 'bg-trace-selected text-trace-selected-fg' : 'bg-highlight text-highlight-fg'),
              row.current &&
                'group-focus/tree:outline-1 group-focus/tree:-outline-offset-1 group-focus/tree:outline-current group-focus/tree:outline-dotted',
            )}
          >
            {row.cells.map((cell, column) => (
              <div
                key={column}
                data-column={column}
                className={cn(
                  'relative flex-none overflow-hidden px-1.5 text-ellipsis whitespace-nowrap',
                  cell.bold && 'font-bold',
                )}
                style={{
                  width: cell.width,
                  color: row.selected ? undefined : cell.color,
                  paddingLeft: column === 0 ? cell.indent : undefined,
                }}
              >
                {column === 0 && row.hasIndicator && (
                  <span data-branch className="absolute top-0 h-full w-5" style={{ left: row.branchLeft }}>
                    <span
                      className={cn(
                        'absolute',
                        row.expanded
                          ? 'top-[calc(50%-2px)] left-[5px] border-x-4 border-t-[5px] border-b-0 border-x-transparent'
                          : 'top-[calc(50%-4px)] left-[7px] border-y-4 border-r-0 border-l-[5px] border-y-transparent',
                        row.expanded && (row.selected ? 'border-t-current' : 'border-t-branch'),
                        !row.expanded && (row.selected ? 'border-l-current' : 'border-l-branch'),
                      )}
                    />
                  </span>
                )}
                {cell.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

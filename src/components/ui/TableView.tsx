import { Table, TableHead, TableCell } from './table';
import type { CellProps, HeaderCellProps, TableViewProps } from '../../types/table';
import { cn } from '../../lib/utils';

export function TableView({
  className,
  children,
  emptyMessage,
  emptyTitle = 'No items yet',
  ...props
}: TableViewProps) {
  return (
    <div
      tabIndex={0}
      className={cn(
        'group/table min-h-0 flex-1 overflow-hidden bg-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
        className,
      )}
      {...props}
    >
      <Table className="min-w-full table-fixed border-separate border-spacing-0 [&_tbody_tr:hover]:bg-secondary/50">
        {children}
      </Table>
      {emptyMessage && (
        <div className="flex min-h-0 flex-col items-center justify-center gap-1.5 px-3 py-2 text-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{emptyTitle}</span>
          <span className="max-w-sm leading-relaxed">{emptyMessage}</span>
        </div>
      )}
    </div>
  );
}

export function HeaderCell({ stretch = false, align = 'left', children }: HeaderCellProps) {
  return (
    <TableHead
      scope="col"
      className={cn(
        'sticky top-0 z-1 h-7 overflow-hidden border-b border-line bg-window px-2 text-[11px] font-medium text-ellipsis whitespace-nowrap text-muted-foreground',
        stretch && 'w-2/5',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </TableHead>
  );
}

export function Cell({
  column,
  selected,
  current = false,
  padding = 'text',
  align = 'left',
  mono = false,
  children,
}: CellProps) {
  return (
    <TableCell
      title={typeof children === 'string' ? children : undefined}
      data-column={column}
      className={cn(
        'h-7 cursor-default scroll-mt-9 overflow-hidden border-b border-grid py-0 text-xs text-ellipsis whitespace-nowrap tabular-nums',
        align === 'right' ? 'text-right' : 'text-left',
        mono && 'font-code',
        padding === 'text' && 'px-2',
        padding === 'none' && 'p-0',
        padding === 'widget' && 'px-[3px] py-px',
        selected && 'bg-highlight text-highlight-fg',
        current &&
          'group-focus-within/table:outline-1 group-focus-within/table:-outline-offset-2 group-focus-within/table:outline-current group-focus-within/table:outline-dotted',
      )}
    >
      {children}
    </TableCell>
  );
}

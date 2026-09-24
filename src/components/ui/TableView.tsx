import { Table, TableHead, TableCell } from './table';
import type { CellProps, HeaderCellProps, TableViewProps } from '../../types/table';
import { cn } from '../../utils/cn';

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
        'group/table min-h-0 flex-1 overflow-auto bg-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
        className,
      )}
      {...props}
    >
      <Table className="min-w-full border-separate border-spacing-0 [&_tbody_tr:hover]:bg-secondary/50">
        {children}
      </Table>
      {emptyMessage && (
        <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 px-6 py-6 text-center text-xs text-muted-foreground">
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
        'sticky top-0 z-1 h-9 border-b border-line bg-window px-4 text-[11px] font-medium whitespace-nowrap text-muted-foreground',
        !stretch && 'w-px',
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
      data-column={column}
      className={cn(
        'h-9 cursor-default scroll-mt-9 border-b border-grid py-0 text-xs whitespace-nowrap tabular-nums',
        align === 'right' ? 'text-right' : 'text-left',
        mono && 'font-code',
        padding === 'text' && 'px-4',
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

import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../../utils/cn';

interface TableViewProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  emptyMessage?: string;
}

export function TableView({ className, children, emptyMessage, ...props }: TableViewProps) {
  return (
    <div
      tabIndex={0}
      className={cn('group/table min-h-0 flex-1 overflow-auto bg-base outline-none', className)}
      {...props}
    >
      <table className="min-w-full border-separate border-spacing-0 [&_tbody_tr:hover]:bg-secondary/50">
        {children}
      </table>
      {emptyMessage && (
        <div className="flex min-h-24 items-center justify-center px-6 py-8 text-center text-xs text-muted">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export function HeaderCell({ stretch = false, children }: { stretch?: boolean; children: ReactNode }) {
  return (
    <th
      className={cn(
        'sticky top-0 z-1 h-9 border-b border-line bg-window px-4 text-left text-[11px] font-medium whitespace-nowrap text-muted',
        !stretch && 'w-px',
      )}
    >
      {children}
    </th>
  );
}

interface CellProps {
  column?: number;
  selected: boolean;
  current?: boolean;
  padding?: 'text' | 'none' | 'widget';
  children: ReactNode;
}

export function Cell({ column, selected, current = false, padding = 'text', children }: CellProps) {
  return (
    <td
      data-column={column}
      className={cn(
        'h-9 cursor-default border-b border-grid text-xs whitespace-nowrap',
        padding === 'text' && 'px-4',
        padding === 'widget' && 'px-[3px] py-px',
        selected && 'bg-highlight text-highlight-fg',
        current &&
          'group-focus-within/table:outline-1 group-focus-within/table:-outline-offset-2 group-focus-within/table:outline-current group-focus-within/table:outline-dotted',
      )}
    >
      {children}
    </td>
  );
}

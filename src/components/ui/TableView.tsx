import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../../utils/cn';

interface TableViewProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function TableView({ className, children, ...props }: TableViewProps) {
  return (
    <div
      tabIndex={0}
      className={cn('group/table min-h-0 flex-1 overflow-auto border border-line bg-base outline-none', className)}
      {...props}
    >
      <table className="min-w-full border-separate border-spacing-0">{children}</table>
    </div>
  );
}

export function HeaderCell({ stretch = false, children }: { stretch?: boolean; children: ReactNode }) {
  return (
    <th
      className={cn(
        'sticky top-0 z-1 h-[23px] border-r border-b border-line bg-linear-to-b/srgb from-header-top to-header-bottom px-1.5 text-center font-normal whitespace-nowrap',
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
        'h-[22px] cursor-default border-r border-b border-grid whitespace-nowrap',
        padding === 'text' && 'px-1.5',
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

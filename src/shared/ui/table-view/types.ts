import type { HTMLAttributes, ReactNode, Ref } from 'react';

export interface TableViewProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  emptyMessage?: string;
  emptyTitle?: string;
}

export interface HeaderCellProps {
  stretch?: boolean;
  align?: 'left' | 'right';
  children: ReactNode;
}

export interface CellProps {
  column?: number;
  align?: 'left' | 'right';
  mono?: boolean;
  selected: boolean;
  current?: boolean;
  padding?: 'text' | 'none' | 'widget';
  children: ReactNode;
}

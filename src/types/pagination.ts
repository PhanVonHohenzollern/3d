import type { RefObject } from 'react';

export interface PaginationOptions {
  rowHeight: number;
  headerHeight?: number;
  minimumColumnWidth?: number;
  selectedIndex?: number;
  selectionKey?: number | string;
}

export interface PaginationControlsProps {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}

export interface ContainerPagination<T> {
  containerRef: RefObject<HTMLDivElement | null>;
  columns: number;
  items: readonly T[];
  controls: PaginationControlsProps;
}

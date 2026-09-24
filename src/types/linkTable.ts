import type { KeyboardEvent, MouseEvent, Ref } from 'react';
import type { LinkTableRow } from './panels';
import type { ContainerPagination } from './pagination';

export interface LinkTableProps {
  tableRef: Ref<HTMLDivElement>;
  headers: readonly string[];
  rows: readonly (LinkTableRow & { index: number })[];
  pagination: ContainerPagination<LinkTableRow & { index: number }>;
  currentRow: number;
  currentColumn: number;
  onMouseDown: (event: MouseEvent) => void;
  onDoubleClick: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  togglePreview: (id: number) => () => void;
}

import type { KeyboardEvent, MouseEvent, Ref } from 'react';
import type { LinkTableRow } from '../types/panels';
import { stopPropagation } from '../utils/events';
import { Cell, HeaderCell, TableView } from './ui/TableView';
import { ToolButton } from './ui/ToolButton';

interface LinkTableProps {
  tableRef: Ref<HTMLDivElement>;
  headers: readonly string[];
  rows: readonly LinkTableRow[];
  currentRow: number;
  currentColumn: number;
  onMouseDown: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  togglePreview: (id: number) => () => void;
}

export function LinkTable({
  tableRef,
  headers,
  rows,
  currentRow,
  currentColumn,
  onMouseDown,
  onKeyDown,
  togglePreview,
}: LinkTableProps) {
  return (
    <TableView
      emptyMessage={rows.length === 0 ? 'Add a connector to configure its point and dimensions.' : undefined}
      ref={tableRef}
      className="h-full w-full min-w-[260px]"
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
    >
      <thead>
        <tr>
          {headers.map((header, column) => (
            <HeaderCell key={header} stretch={column === 3}>
              {header}
            </HeaderCell>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} data-row={index}>
            {row.texts.map((text, column) => (
              <Cell
                key={column}
                column={column}
                selected={index === currentRow}
                current={index === currentRow && column === currentColumn}
              >
                {text}
              </Cell>
            ))}
            <Cell column={4} selected={index === currentRow} padding="widget">
              <ToolButton
                sizeClassName="min-h-[22px] min-w-16 px-2 py-0.5"
                onMouseDown={stopPropagation}
                onClick={togglePreview(row.id)}
              >
                {row.buttonText}
              </ToolButton>
            </Cell>
          </tr>
        ))}
      </tbody>
    </TableView>
  );
}

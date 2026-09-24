import { PaginationControls } from './PaginationControls';
import type { LinkTableProps } from '../types/linkTable';
import { stopPropagation } from '../utils/events';
import { Cell, HeaderCell, TableView } from './ui/TableView';
import { ToolButton } from './ui/ToolButton';

export function LinkTable({
  tableRef,
  headers,
  rows,
  pagination,
  currentRow,
  currentColumn,
  onMouseDown,
  onDoubleClick,
  onKeyDown,
  togglePreview,
}: LinkTableProps) {
  const { containerRef: paginationRef, controls } = pagination;

  return (
    <div ref={paginationRef} className="flex h-full min-h-0 flex-1 flex-col">
      <TableView
        emptyTitle="No connectors yet"
        emptyMessage={controls.total === 0 ? 'Add a connector to configure its point and dimensions.' : undefined}
        ref={tableRef}
        className="h-full w-full min-w-0"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
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
          {rows.map((row) => (
            <tr key={row.id} data-row={row.index}>
              {row.texts.map((text, column) => (
                <Cell
                  key={column}
                  column={column}
                  selected={row.index === currentRow}
                  current={row.index === currentRow && column === currentColumn}
                >
                  {text}
                </Cell>
              ))}
              <Cell column={4} selected={row.index === currentRow} padding="widget">
                <ToolButton
                  sizeClassName="h-6 min-w-0 px-1 py-0.5"
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
      <PaginationControls {...controls} />
    </div>
  );
}

import { useVariablePanel } from '../hooks/useVariablePanel';
import type { VariablePanelProps } from '../types/panels';
import { Cell, HeaderCell, TableView } from './ui/TableView';

export function VariablePanel(props: VariablePanelProps) {
  const { tableRef, summary, rows, selectedRow, onMouseDown, onMouseUp, onKeyDown } = useVariablePanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none overflow-hidden border-b border-line px-4 py-2 text-[11px] text-ellipsis whitespace-pre text-muted">
        {summary}
      </div>
      <TableView
        emptyMessage={rows.length === 0 ? 'Variables will appear as you write and preview code.' : undefined}
        ref={tableRef}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            <HeaderCell>Name</HeaderCell>
            <HeaderCell>Type</HeaderCell>
            <HeaderCell stretch>Current Value</HeaderCell>
            <HeaderCell>Changed</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} data-row={index}>
              <Cell selected={index === selectedRow}>{row.name}</Cell>
              <Cell selected={index === selectedRow}>{row.type}</Cell>
              <Cell selected={index === selectedRow}>{row.value}</Cell>
              <Cell selected={index === selectedRow}>{row.changed}</Cell>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}

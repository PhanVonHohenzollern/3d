import { useVariablePanel } from '../hooks/useVariablePanel';
import type { VariablePanelProps } from '../types/panels';
import { Cell, HeaderCell, TableView } from './ui/TableView';

export function VariablePanel(props: VariablePanelProps) {
  const { tableRef, summary, rows, onMouseDown, onMouseUp, onKeyDown } = useVariablePanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none overflow-hidden border-b border-line px-4 py-2 text-[11px] text-ellipsis whitespace-pre text-muted-foreground">
        {summary}
      </div>
      <TableView
        emptyTitle="No variables at this cursor"
        emptyMessage={
          rows.length === 0 ? 'Declare a variable, then move the cursor below it to inspect its value.' : undefined
        }
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
              <Cell mono selected={row.selected}>
                {row.name}
              </Cell>
              <Cell mono selected={row.selected}>
                {row.type}
              </Cell>
              <Cell mono selected={row.selected}>
                {row.value}
              </Cell>
              <Cell selected={row.selected}>{row.changed}</Cell>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}

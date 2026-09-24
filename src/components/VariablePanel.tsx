import { useVariablePanel } from '../hooks/useVariablePanel';
import type { VariablePanelProps } from '../types/panels';
import { Cell, HeaderCell, TableView } from './ui/TableView';

export function VariablePanel(props: VariablePanelProps) {
  const { tableRef, summary, rows, onMouseDown, onMouseUp, onKeyDown } = useVariablePanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        title={summary}
        className="flex h-8 shrink-0 items-center overflow-hidden border-b border-line px-2 text-[11px] text-ellipsis whitespace-nowrap text-muted-foreground"
      >
        Read-only values at the code cursor
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <TableView
          className="overflow-auto"
          emptyTitle="Move the cursor below a declaration"
          emptyMessage={
            rows.length === 0
              ? 'Try double width = 20; in the editor, then place the cursor on the next line.'
              : undefined
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
            {rows.map((row) => (
              <tr key={row.index} data-row={row.index}>
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
    </div>
  );
}

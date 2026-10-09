import { useVariablePanel } from '@/widgets/variable-panel/model/useVariablePanel';
import type { VariablePanelProps } from '@/widgets/variable-panel/model/types';
import { Cell, HeaderCell, TableView } from '@/shared/ui/table-view';

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

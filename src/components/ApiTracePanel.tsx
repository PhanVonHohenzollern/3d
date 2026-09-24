import { useApiTracePanel } from '../hooks/useApiTracePanel';
import type { ApiTracePanelProps } from '../types/panels';
import { preventDefault } from '../utils/events';
import { ApiHistoryDialog } from './ApiHistoryDialog';
import { TreeView } from './TreeView';
import { ToolButton } from './ui/ToolButton';

export function ApiTracePanel(props: ApiTracePanelProps) {
  const { tree, dialog, clearFocus } = useApiTracePanel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none justify-start pb-0.5">
        <ToolButton onMouseDown={preventDefault} onClick={clearFocus}>
          Clear API Focus
        </ToolButton>
      </div>
      <TreeView tree={tree} variant="trace" />
      {dialog && <ApiHistoryDialog key={dialog.id} dialog={dialog} />}
    </div>
  );
}

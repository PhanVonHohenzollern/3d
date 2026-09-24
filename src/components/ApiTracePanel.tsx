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
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground"
          title="Select a call to highlight its geometry. Expand the arrow to inspect inputs."
        >
          Select a call · Expand to see inputs
        </span>
        <ToolButton sizeClassName="h-6 px-2 text-[11px]" onMouseDown={preventDefault} onClick={clearFocus}>
          Clear selection
        </ToolButton>
      </div>
      <TreeView tree={tree} variant="trace" />
      {dialog && <ApiHistoryDialog key={dialog.id} dialog={dialog} />}
    </div>
  );
}

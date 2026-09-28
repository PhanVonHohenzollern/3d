import type { ApiHistoryDialogModel } from '@/widgets/api-trace-panel/model/ApiHistoryDialogModel';
import { useApiHistoryDialog } from '@/widgets/api-trace-panel/model/useApiHistoryDialog';
import { FloatingWindow } from '@/shared/ui/floating-window';
import { PushButton } from '@/shared/ui/PushButton';
import { TreeView } from '@/shared/ui/tree';

export function ApiHistoryDialog({ dialog }: { dialog: ApiHistoryDialogModel }) {
  const { open, title, caption, tree, raiseSerial, close } = useApiHistoryDialog(dialog);
  if (!open) return null;

  return (
    <FloatingWindow title={title} raiseSerial={raiseSerial} onClose={close}>
      <div className="flex-none wrap-anywhere whitespace-pre-wrap select-text">{caption}</div>
      <TreeView tree={tree} />
      <div className="flex flex-none justify-end">
        <PushButton onClick={close}>Close</PushButton>
      </div>
    </FloatingWindow>
  );
}

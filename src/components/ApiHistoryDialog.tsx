import type { ApiHistoryDialogModel } from '@/hooks/apiTrace/ApiHistoryDialogModel';
import { useApiHistoryDialog } from '@/hooks/useApiHistoryDialog';
import { FloatingWindow } from '@/components/ui/FloatingWindow';
import { PushButton } from '@/components/ui/PushButton';
import { TreeView } from '@/components/TreeView';

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

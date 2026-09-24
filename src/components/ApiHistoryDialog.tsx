import type { ApiHistoryDialogModel } from '../hooks/apiTrace/ApiHistoryDialogModel';
import { useApiHistoryDialog } from '../hooks/useApiHistoryDialog';
import { FloatingWindow } from './ui/FloatingWindow';
import { PushButton } from './ui/PushButton';
import { TreeView } from './TreeView';

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

import type { ApiHistoryDialogModel } from '@/hooks/apiTrace/ApiHistoryDialogModel';
import { useObservable } from '@/hooks/useObservable';

export function useApiHistoryDialog(dialog: ApiHistoryDialogModel) {
  useObservable(dialog);

  return {
    open: dialog.isOpen(),
    title: dialog.windowTitle,
    caption: dialog.caption,
    tree: dialog.tree,
    raiseSerial: dialog.raiseSerial(),
    close: () => dialog.close(),
  };
}

import type { ApiHistoryDialogModel } from './apiTrace/ApiHistoryDialogModel';
import { useObservable } from './useObservable';

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

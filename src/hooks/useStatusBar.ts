import type { StatusBarModel } from './mainWindow/StatusBarModel';
import { useObservable } from './useObservable';

export function useStatusBar(model: StatusBarModel): string {
  useObservable(model);
  return model.currentMessage();
}

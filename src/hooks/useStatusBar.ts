import type { StatusBarModel } from './mainWindow/StatusBarModel';
import { useObservable } from './useObservable';

export function useStatusBar(model: StatusBarModel) {
  useObservable(model);

  return { message: model.currentMessage() || 'Ready', tone: model.currentTone() };
}

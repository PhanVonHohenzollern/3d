import { useSyncExternalStore } from 'react';
import type { Observable } from '@/hooks/observable/Observable';

export function useObservable(model: Observable): number {
  return useSyncExternalStore(model.subscribe, model.version);
}

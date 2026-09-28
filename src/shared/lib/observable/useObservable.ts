import { useSyncExternalStore } from 'react';
import type { Observable } from '@/shared/lib/observable/Observable';

export function useObservable(model: Observable): number {
  return useSyncExternalStore(model.subscribe, model.version);
}

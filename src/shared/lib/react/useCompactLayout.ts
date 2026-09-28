import { useSyncExternalStore } from 'react';

const compactQuery = '(max-width: 767px)';

function subscribeLayout(callback: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', callback);

  return () => media.removeEventListener('change', callback);
}

function compactLayout() {
  return window.matchMedia(compactQuery).matches;
}

export function useCompactLayout() {
  return useSyncExternalStore(subscribeLayout, compactLayout);
}

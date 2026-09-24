import { useSyncExternalStore } from 'react';
import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import { preventDefault } from '../utils/events';

export function useSelectionModeButton(engine: ViewportEngine) {
  const { text, geometry } = useSyncExternalStore(engine.subscribeWidgets, engine.selectionModeButton);

  return {
    text,
    style: { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height },
    onClick: () => engine.selectionModeButtonClicked(),
    onPointerEnter: () => engine.eventFilter('Enter'),
    onFocus: () => engine.eventFilter('FocusIn'),
    onContextMenu: preventDefault,
  };
}

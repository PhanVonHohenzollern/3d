import { useSyncExternalStore } from 'react';
import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import { preventDefault } from '../utils/events';

export function useSelectionModeButton(engine: ViewportEngine) {
  const { text, geometry } = useSyncExternalStore(engine.subscribeWidgets, engine.selectionModeButton);
  const presentation = useSyncExternalStore(engine.subscribeWidgets, engine.selectionPresentation);
  const presentationRect = engine.presentationButtonRect();

  return {
    text,
    presentation,
    presentationStyle: {
      left: presentationRect.x,
      top: presentationRect.y,
      width: presentationRect.width,
      height: presentationRect.height,
    },
    togglePresentation: () => engine.toggleSelectionPresentation(),
    style: { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height },
    onClick: () => engine.selectionModeButtonClicked(),
    onPointerEnter: () => engine.eventFilter('Enter'),
    onFocus: () => engine.eventFilter('FocusIn'),
    onContextMenu: preventDefault,
  };
}

import { useSyncExternalStore } from 'react';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';

export function useSelectionModeButton(engine: ViewportEngine) {
  const { text, geometry } = useSyncExternalStore(engine.subscribeWidgets, engine.selectionModeButton);
  const isolated = useSyncExternalStore(engine.subscribeWidgets, engine.isSelectionIsolated);
  const presentationRect = engine.presentationButtonRect();

  return {
    text,
    isolated,
    presentationStyle: {
      left: presentationRect.x,
      top: presentationRect.y,
      width: presentationRect.width,
      height: presentationRect.height,
    },
    togglePresentation: () => engine.toggleIsolation(),
    style: { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height },
    onClick: () => engine.selectionModeButtonClicked(),
    onPointerEnter: () => engine.eventFilter('Enter'),
    onFocus: () => engine.eventFilter('FocusIn'),
  };
}

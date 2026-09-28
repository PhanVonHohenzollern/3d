import type { Ref } from 'react';
import type { Viewport3DHandle, Viewport3DProps } from '@/widgets/viewport/model/types';
import { useViewportEngine } from '@/widgets/viewport/model/useViewportEngine';
import { useViewportPointer } from '@/widgets/viewport/model/useViewportPointer';
import { useViewportSurface, type ViewportSurfaceRefs } from '@/widgets/viewport/model/useViewportSurface';

export function useViewport3D(
  ref: Ref<Viewport3DHandle> | undefined,
  props: Viewport3DProps,
  surface: ViewportSurfaceRefs,
) {
  const engine = useViewportEngine(ref, props);
  useViewportSurface(engine, surface);
  const overlayHandlers = useViewportPointer(engine, surface.hostRef);

  return {
    engine,
    overlayHandlers,
    pointPanel: engine.pointLabelPanel(),
    vectorPanel: engine.vectorLabelPanel(),
    onChildEnter: () => engine.eventFilter('Enter'),
    onChildFocus: () => engine.eventFilter('FocusIn'),
  };
}

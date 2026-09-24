import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { ViewportEngine } from '../core/viewport/ViewportEngine';
import { createViewport3DHandle } from '../helpers/viewportHandle';
import type { Viewport3DHandle, Viewport3DProps } from '../types/viewport';

export function useViewportEngine(ref: Ref<Viewport3DHandle> | undefined, props: Viewport3DProps): ViewportEngine {
  const [engine] = useState(() => new ViewportEngine());
  const propsRef = useRef(props);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useLayoutEffect(() => {
    engine.setSelectionChangedCallback((names) => propsRef.current.onSelectionChanged?.(names));
    engine.setPointCreationCallback((point) => propsRef.current.onPointCreation?.(point));
    engine.setMeshSelectionCallback((apiIndex, sourceLine) => propsRef.current.onMeshSelection?.(apiIndex, sourceLine));
    engine.setConnectorSelectionCallback((id) => propsRef.current.onConnectorSelection?.(id));
    return () => {
      engine.setSelectionChangedCallback(null);
      engine.setPointCreationCallback(null);
      engine.setMeshSelectionCallback(null);
      engine.setConnectorSelectionCallback(null);
    };
  }, [engine]);

  useImperativeHandle(ref, () => createViewport3DHandle(engine), [engine]);

  return engine;
}

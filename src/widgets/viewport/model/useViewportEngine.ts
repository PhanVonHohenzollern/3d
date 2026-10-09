import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import { createViewport3DHandle } from '@/widgets/viewport/model/viewportHandle';
import type { Viewport3DHandle, Viewport3DProps } from '@/widgets/viewport/model/types';

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

  useLayoutEffect(() => {
    engine.setLightTheme(props.lightTheme ?? false);
  }, [engine, props.lightTheme]);

  return engine;
}

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { clampDockHeight, kDocks } from '../helpers/layout';
import type { DockName } from '../types/mainWindow';
import { usePointerDrag } from './usePointerDrag';

export function useDockArea(raised: DockName, raise: (name: DockName) => void) {
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(() => Math.round(window.innerHeight * 0.3));
  const startDrag = usePointerDrag();

  useLayoutEffect(() => {
    const area = mainAreaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => setDockHeight((height) => clampDockHeight(height, area.clientHeight)));
    observer.observe(area);

    return () => observer.disconnect();
  }, []);

  const onSeparatorPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const startHeight = dockHeight;
    const areaHeight = mainAreaRef.current?.clientHeight ?? window.innerHeight;
    startDrag(event, (_dx, dy) => setDockHeight(clampDockHeight(startHeight - dy, areaHeight)));
  };

  const tabs = kDocks.map((dock) => ({ ...dock, selected: dock.name === raised, raise: () => raise(dock.name) }));
  const title = tabs.find((tab) => tab.selected)?.title ?? '';

  return { mainAreaRef, dockHeight, onSeparatorPointerDown, title, tabs };
}

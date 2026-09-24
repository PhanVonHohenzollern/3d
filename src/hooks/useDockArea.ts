import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { clampDockHeight, kDocks } from '../helpers/layout';
import type { DockName } from '../types/mainWindow';
import { usePointerDrag } from './usePointerDrag';

export function useDockArea(raised: DockName, raise: (name: DockName) => void) {
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(() => Math.min(360, Math.round(window.innerHeight * 0.36)));
  const startDrag = usePointerDrag();
  const [areaHeight, setAreaHeight] = useState(window.innerHeight);
  const [areaWidth, setAreaWidth] = useState(window.innerWidth);
  // Match the Link form's 4 / 2 / 1 column layout, including the dock insets.
  const linkMinimum = areaWidth >= 990 ? 280 : areaWidth >= 550 ? 380 : 560;
  const minimum = raised === 'LinkDock' ? linkMinimum : clampDockHeight(0, areaHeight);
  const maximum = Math.max(minimum, clampDockHeight(Infinity, areaHeight));
  const visibleHeight = Math.min(Math.max(dockHeight, minimum), maximum);

  useLayoutEffect(() => {
    const area = mainAreaRef.current;
    if (!area) return;

    const measure = () => {
      setAreaHeight(area.clientHeight);
      setAreaWidth(area.clientWidth);
      setDockHeight((height) => clampDockHeight(height, area.clientHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);

    return () => observer.disconnect();
  }, []);

  const onSeparatorPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.focus();
    const startHeight = visibleHeight;
    const areaHeight = mainAreaRef.current?.clientHeight ?? window.innerHeight;
    startDrag(event, (_dx, dy) => setDockHeight(Math.max(minimum, clampDockHeight(startHeight - dy, areaHeight))));
  };

  const onSeparatorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const step = event.shiftKey ? 48 : 16;
    const areaHeight = mainAreaRef.current?.clientHeight ?? window.innerHeight;
    setDockHeight(
      Math.max(minimum, clampDockHeight(visibleHeight + (event.key === 'ArrowUp' ? step : -step), areaHeight)),
    );
  };

  const tabs = kDocks.map((dock) => ({ ...dock, selected: dock.name === raised, raise: () => raise(dock.name) }));
  const title = tabs.find((tab) => tab.selected)?.title ?? '';

  return {
    mainAreaRef,
    dockHeight: visibleHeight,
    onSeparatorPointerDown,
    onSeparatorKeyDown,
    minimum,
    maximum,
    title,
    tabs,
  };
}

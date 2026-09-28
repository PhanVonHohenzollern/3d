import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { clampDockHeight } from '@/shared/ui/dock/sizes';
import { usePointerDrag } from '@/shared/lib/react';

// The height of a dock under a resizable area. minimumHeight lets the raised tab ask for more room
// on narrow screens.
export function useDockHeight(minimumHeight?: (areaWidth: number) => number) {
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(() => Math.min(360, Math.round(window.innerHeight * 0.36)));
  const startDrag = usePointerDrag();
  const [areaHeight, setAreaHeight] = useState(window.innerHeight);
  const [areaWidth, setAreaWidth] = useState(window.innerWidth);
  const minimum = minimumHeight ? minimumHeight(areaWidth) : clampDockHeight(0, areaHeight);
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

  return {
    mainAreaRef,
    dockHeight: visibleHeight,
    onSeparatorPointerDown,
    onSeparatorKeyDown,
    minimum,
    maximum,
  };
}

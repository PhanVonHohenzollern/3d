import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { distributeSplitterSizes, draggedSplitterSizes, kSplitterHandleSize } from '../helpers/layout';
import { usePointerDrag } from './usePointerDrag';

export interface SplitterOptions {
  orientation: 'horizontal' | 'vertical';
  initialSizes: [number, number];
  stretchFactors?: [number, number];
}

export function useSplitter({ orientation, initialSizes, stretchFactors = [0, 0] }: SplitterOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<[number, number]>(initialSizes);
  const [stretch] = useState(stretchFactors);
  const startDrag = usePointerDrag();
  const horizontal = orientation === 'horizontal';

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const total = (horizontal ? container.clientWidth : container.clientHeight) - kSplitterHandleSize;
      if (total > 0) setSizes((current) => distributeSplitterSizes(current, total, stretch));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [horizontal, stretch]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const start = sizes;
    startDrag(event, (dx, dy) => setSizes(draggedSplitterSizes(start, horizontal ? dx : dy)));
  };

  const paneStyles = sizes.map((size) => (horizontal ? { width: size } : { height: size }));

  return { containerRef, paneStyles, horizontal, onHandlePointerDown };
}

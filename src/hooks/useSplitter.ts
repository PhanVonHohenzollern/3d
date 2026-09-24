import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  distributeSplitterSizes,
  draggedSplitterSizes,
  kMinimumPaneSize,
  kSplitterHandleSize,
} from '../helpers/layout';
import type { SplitterOptions } from '../types/layout';
import { usePointerDrag } from './usePointerDrag';

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
      if (total > 0) setSizes((current) => draggedSplitterSizes(distributeSplitterSizes(current, total, stretch), 0));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [horizontal, stretch]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.focus();
    const start = sizes;
    startDrag(event, (dx, dy) => setSizes(draggedSplitterSizes(start, horizontal ? dx : dy)));
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const increase = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== decrease && event.key !== increase) return;
    event.preventDefault();
    const step = event.shiftKey ? 48 : 16;
    setSizes((current) => draggedSplitterSizes(current, event.key === decrease ? -step : step));
  };

  const total = sizes[0] + sizes[1];
  const minimum = Math.min(kMinimumPaneSize, total / 2);
  const paneStyles = sizes.map((size) => (horizontal ? { width: size } : { height: size }));

  return {
    containerRef,
    paneStyles,
    horizontal,
    onHandlePointerDown,
    onHandleKeyDown,
    value: sizes[0],
    min: minimum,
    max: total - minimum,
  };
}

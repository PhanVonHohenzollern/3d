// QSplitter with two children. Sizes are pixels, like QSplitter::setSizes();
// when the splitter itself is resized the difference is distributed by the
// stretch factors (QSplitter::setStretchFactor), or proportionally to the
// current sizes when both factors are 0. The handle can be dragged.

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

export interface SplitterProps {
  orientation: 'horizontal' | 'vertical';
  initialSizes: [number, number];
  stretchFactors?: [number, number];
  className?: string;
  children: [ReactNode, ReactNode];
}

const kHandleSize = 5;

function distribute(sizes: [number, number], total: number, stretch: [number, number]): [number, number] {
  const current = sizes[0] + sizes[1];
  const delta = total - current;
  if (delta === 0) return sizes;
  let weights: [number, number] = stretch[0] + stretch[1] > 0 ? stretch : sizes;
  if (weights[0] + weights[1] <= 0) weights = [1, 1];
  const first = Math.min(Math.max(sizes[0] + (delta * weights[0]) / (weights[0] + weights[1]), 0), Math.max(total, 0));
  return [first, Math.max(total - first, 0)];
}

export function Splitter({ orientation, initialSizes, stretchFactors = [0, 0], className, children }: SplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<[number, number]>(initialSizes);
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const horizontal = orientation === 'horizontal';

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const total = (horizontal ? container.clientWidth : container.clientHeight) - kHandleSize;
      if (total <= 0) return;
      const next = distribute(sizesRef.current, total, stretchFactors);
      if (next[0] !== sizesRef.current[0] || next[1] !== sizesRef.current[1]) {
        sizesRef.current = next;
        setSizes(next);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
    // stretchFactors is a constant per splitter instance (as in QSplitter setup).
  }, [horizontal]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const start = horizontal ? event.clientX : event.clientY;
    const startSizes = sizesRef.current;
    const total = startSizes[0] + startSizes[1];
    const move = (e: PointerEvent) => {
      const position = horizontal ? e.clientX : e.clientY;
      const first = Math.min(Math.max(startSizes[0] + position - start, 0), total);
      const next: [number, number] = [first, total - first];
      sizesRef.current = next;
      setSizes(next);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  const dimension = horizontal ? 'width' : 'height';
  return (
    <div ref={containerRef} className={`splitter splitter-${orientation}${className ? ` ${className}` : ''}`}>
      <div className="splitter-pane" style={{ [dimension]: sizes[0] }}>{children[0]}</div>
      <div className="splitter-handle" onPointerDown={onHandlePointerDown} />
      <div className="splitter-pane" style={{ [dimension]: sizes[1] }}>{children[1]}</div>
    </div>
  );
}

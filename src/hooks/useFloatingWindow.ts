import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { initialFloatingGeometry, movedFloatingGeometry, resizedFloatingGeometry } from '../helpers/layout';
import { usePointerDrag } from './usePointerDrag';

export function useFloatingWindow(raiseSerial: number, onClose: () => void) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState(() => initialFloatingGeometry(window.innerWidth, window.innerHeight));
  const startDrag = usePointerDrag();

  useLayoutEffect(() => {
    windowRef.current?.focus({ preventScroll: true });
  }, [raiseSerial]);

  const onTitlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as Element).closest('button')) return;
    const start = geometry;
    startDrag(event, (dx, dy) =>
      setGeometry(movedFloatingGeometry(start, dx, dy, window.innerWidth, window.innerHeight)),
    );
  };

  const onGripPointerDown = (event: PointerEvent<HTMLElement>) => {
    const start = geometry;
    startDrag(event, (dx, dy) => setGeometry(resizedFloatingGeometry(start, dx, dy)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  };

  return { windowRef, geometry, onTitlePointerDown, onGripPointerDown, onKeyDown };
}

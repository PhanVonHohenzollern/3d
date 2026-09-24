import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';

export type DragMove = (dx: number, dy: number) => void;

export function usePointerDrag(): (event: ReactPointerEvent<HTMLElement>, onMove: DragMove) => void {
  return useCallback((event, onMove) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (e: PointerEvent) => onMove(e.clientX - startX, e.clientY - startY);
    const up = () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  }, []);
}

import { useRef, type PointerEvent, type RefObject } from 'react';
import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import { NoButton, mouseButtonFromDom, mouseButtonsFromDom, mouseEventData } from '../helpers/qtInput';
import { capturePointer } from '../utils/dom';
import { preventDefault } from '../utils/events';

type CanvasPointerEvent = PointerEvent<HTMLCanvasElement>;

export function useViewportPointer(engine: ViewportEngine, hostRef: RefObject<HTMLDivElement | null>) {
  const buttonsRef = useRef(0);

  const data = (e: CanvasPointerEvent, button: number, buttons: number) =>
    mouseEventData(e, e.currentTarget.getBoundingClientRect(), button, buttons);

  const onPointerDown = (e: CanvasPointerEvent) => {
    hostRef.current?.focus({ preventScroll: true });
    e.preventDefault();
    capturePointer(e.currentTarget, e.pointerId);
    const button = mouseButtonFromDom(e.button);
    buttonsRef.current = mouseButtonsFromDom(e.buttons) | button;
    engine.mousePressEvent(data(e, button, buttonsRef.current));
  };

  const onPointerMove = (e: CanvasPointerEvent) => {
    const buttons = mouseButtonsFromDom(e.buttons);
    const chordChanged = e.button >= 0 && buttons !== buttonsRef.current;
    buttonsRef.current = buttons;
    if (!chordChanged) {
      engine.mouseMoveEvent(data(e, NoButton, buttons));
      return;
    }
    const button = mouseButtonFromDom(e.button);
    if (buttons & button) engine.mousePressEvent(data(e, button, buttons));
    else engine.mouseReleaseEvent(data(e, button, buttons));
  };

  const onPointerUp = (e: CanvasPointerEvent) => {
    buttonsRef.current = mouseButtonsFromDom(e.buttons);
    engine.mouseReleaseEvent(data(e, mouseButtonFromDom(e.button), buttonsRef.current));
  };

  const onPointerCancel = (e: CanvasPointerEvent) => {
    buttonsRef.current = 0;
    engine.mouseReleaseEvent(data(e, NoButton, 0));
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave: () => engine.leaveEvent(),
    onMouseDown: preventDefault,
    onAuxClick: preventDefault,
    onContextMenu: preventDefault,
  };
}

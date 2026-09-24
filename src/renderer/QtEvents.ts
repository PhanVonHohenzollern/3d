// Qt mouse/keyboard event data used by the viewport and the label lists, and
// the translation from DOM events. Qt logical pixels are CSS pixels.

/** Qt::MouseButton bits; identical to the DOM MouseEvent.buttons bits. */
export const NoButton = 0;
export const LeftButton = 1;
export const RightButton = 2;
export const MiddleButton = 4;

/** Qt::KeyboardModifiers. On macOS Command counts as Control, like Qt's ControlModifier. */
export interface KeyboardModifiers {
  control: boolean;
  shift: boolean;
  alt: boolean;
}

export const NoModifier: KeyboardModifiers = { control: false, shift: false, alt: false };

export function modifiersFromEvent(e: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): KeyboardModifiers {
  return { control: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
}

/** DOM MouseEvent.button (0 left, 1 middle, 2 right) -> Qt::MouseButton. */
export function mouseButtonFromDom(button: number): number {
  return button === 0 ? LeftButton : button === 1 ? MiddleButton : button === 2 ? RightButton : NoButton;
}

/** DOM MouseEvent.buttons -> Qt::MouseButtons (left/right/middle only). */
export function mouseButtonsFromDom(buttons: number): number {
  return buttons & (LeftButton | RightButton | MiddleButton);
}

/** QMouseEvent: position() in logical pixels, button() and buttons(). */
export interface MouseEventData {
  x: number;
  y: number;
  button: number;
  buttons: number;
  modifiers: KeyboardModifiers;
}

/** QWheelEvent: position() and angleDelta().y() (120 per wheel notch). */
export interface WheelEventData {
  x: number;
  y: number;
  angleDeltaY: number;
}

/**
 * WheelEvent.deltaY -> QWheelEvent::angleDelta().y(). One wheel notch is 120
 * in Qt and positive when the wheel turns away from the user; browsers report
 * about 100 px (pixel mode, Chromium/WebKit) or 3 lines (line mode, Firefox)
 * per notch, positive towards the user.
 */
export function wheelAngleDeltaY(e: { deltaY: number; deltaMode: number }): number {
  const DOM_DELTA_LINE = 1;
  const DOM_DELTA_PAGE = 2;
  if (e.deltaMode === DOM_DELTA_LINE) return -e.deltaY * 40;
  if (e.deltaMode === DOM_DELTA_PAGE) return -e.deltaY * 120;
  return -e.deltaY * 1.2;
}

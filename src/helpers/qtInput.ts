import type { KeyboardModifiers, MouseEventData } from '../types/input';

export const NoButton = 0;
export const LeftButton = 1;
export const RightButton = 2;
export const MiddleButton = 4;

export const NoModifier: KeyboardModifiers = { control: false, shift: false, alt: false };

const kDomMiddleButton = 1;
const kDomDeltaLine = 1;
const kDomDeltaPage = 2;
const kQtAngleDeltaPerNotch = 120;
const kBrowserPixelsPerNotch = 100;
const kBrowserLinesPerNotch = 3;

interface DomModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface DomPointer extends DomModifiers {
  clientX: number;
  clientY: number;
}

export function modifiersFromEvent(e: DomModifiers): KeyboardModifiers {
  return { control: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
}

export function mouseButtonFromDom(button: number): number {
  return button === 0 ? LeftButton : button === 1 ? MiddleButton : button === 2 ? RightButton : NoButton;
}

export function mouseButtonsFromDom(buttons: number): number {
  return buttons & (LeftButton | RightButton | MiddleButton);
}

export function isDomMiddleButton(button: number): boolean {
  return button === kDomMiddleButton;
}

export function mouseEventData(
  e: DomPointer,
  origin: { left: number; top: number },
  button: number,
  buttons: number,
): MouseEventData {
  return { x: e.clientX - origin.left, y: e.clientY - origin.top, button, buttons, modifiers: modifiersFromEvent(e) };
}

export function wheelAngleDeltaY(e: { deltaY: number; deltaMode: number }): number {
  if (e.deltaMode === kDomDeltaLine) return -e.deltaY * (kQtAngleDeltaPerNotch / kBrowserLinesPerNotch);
  if (e.deltaMode === kDomDeltaPage) return -e.deltaY * kQtAngleDeltaPerNotch;
  return -e.deltaY * (kQtAngleDeltaPerNotch / kBrowserPixelsPerNotch);
}

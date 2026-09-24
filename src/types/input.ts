export interface KeyboardModifiers {
  control: boolean;
  shift: boolean;
  alt: boolean;
}

export interface MouseEventData {
  x: number;
  y: number;
  button: number;
  buttons: number;
  modifiers: KeyboardModifiers;
}

export interface WheelEventData {
  x: number;
  y: number;
  angleDeltaY: number;
}

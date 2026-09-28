export interface QColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type PenCapStyle = 'SquareCap' | 'RoundCap';

export interface QPen {
  color: QColor;
  width: number;
  cap: PenCapStyle;
}

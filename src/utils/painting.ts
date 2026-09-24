import type { PenCapStyle, QColor, QPen } from '../types/painting';

export function qColor(r: number, g: number, b: number, a = 255): QColor {
  return { r, g, b, a };
}

export function cssColor(c: QColor): string {
  return c.a >= 255 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`;
}

export function qPen(color: QColor, width = 1, cap: PenCapStyle = 'SquareCap'): QPen {
  return { color, width, cap };
}

export const Qt = {
  white: qColor(255, 255, 255),
} as const;

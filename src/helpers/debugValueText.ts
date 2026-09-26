import type { Vec3 } from '../types/viewport';
import { formatFixed } from '../utils/cpp';

function coordinateText(value: number): string {
  const text = formatFixed(value, 3)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');

  return text === '-0' ? '0' : text;
}

export function debugValueText(p: Vec3): string {
  return `(${coordinateText(p.x)}, ${coordinateText(p.y)}, ${coordinateText(p.z)})`;
}

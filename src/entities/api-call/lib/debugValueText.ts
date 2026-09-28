import { formatFixed } from '@engine/runtime';

function coordinateText(value: number): string {
  const text = formatFixed(value, 3)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');

  return text === '-0' ? '0' : text;
}

export function debugValueText(p: { x: number; y: number; z: number }): string {
  return `(${coordinateText(p.x)}, ${coordinateText(p.y)}, ${coordinateText(p.z)})`;
}

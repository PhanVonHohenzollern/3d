import type { Vec3 } from '../types/viewport';
import { formatFixed } from '../utils/cpp';
import { escapeRegExp } from '../utils/regexp';

export function formatCoordinate(value: number): string {
  value = Math.fround(value);
  if (Math.abs(value) < Math.fround(0.0005)) value = 0.0;
  let text = formatFixed(value, 3);
  while (text.includes('.') && text.endsWith('0')) text = text.slice(0, -1);
  if (text.endsWith('.')) text = text.slice(0, -1);

  return text;
}

export function pointDeclaration(name: string, point: Vec3): string {
  return `FdPoint3d ${name}(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)}, ${formatCoordinate(point.z)});`;
}

export function unusedPreviewPointName(code: string): string {
  for (let i = 1; i < 10000; ++i) {
    const candidate = `pPreview${i}`;
    if (!new RegExp(`\\b${escapeRegExp(candidate)}\\b`).test(code)) return candidate;
  }

  return 'pPreview';
}

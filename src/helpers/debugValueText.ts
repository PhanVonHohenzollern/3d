import type { Vec3 } from '../types/viewport';
import { formatGeneral } from '../utils/cpp';

export function debugValueText(p: Vec3): string {
  return `(${formatGeneral(p.x, 7)}, ${formatGeneral(p.y, 7)}, ${formatGeneral(p.z, 7)})`;
}

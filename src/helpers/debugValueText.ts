import type { Vec3 } from '../types/viewport';
import { runtimeValueToCompactString } from '../core/runtime/RuntimeValue';

export function debugValueText(p: Vec3): string {
  return `(${runtimeValueToCompactString(p.x)}, ${runtimeValueToCompactString(p.y)}, ${runtimeValueToCompactString(p.z)})`;
}

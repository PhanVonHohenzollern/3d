import {
  rotationMatrix,
  transformDirection,
  transformPoint,
  translationMatrix,
  type DMat4,
} from '../../../utils/dmat4';
import { DVec3 } from '../../../utils/DVec3';
import { FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import type { PreviewMesh } from '../previewScene';
import { validDirection } from './geometryMath';
import { f32 } from './meshData';
import { asNumber, asVector, ref } from './valueDecoding';

export function meshTransformDelta(args: RuntimeValue[]): DMat4 | null {
  if (args.length === 1) {
    const translation = ref(new FdVector3d());
    return asVector(args[0], translation) ? translationMatrix(translation.v) : null;
  }
  if (args.length === 2) {
    const angle = ref(0.0);
    const axis = ref(new FdVector3d());
    if (asNumber(args[0], angle) && asVector(args[1], axis) && validDirection(axis.v))
      return rotationMatrix(angle.v, axis.v);
  }
  return null;
}

export function applyTransform(mesh: PreviewMesh, matrix: DMat4): void {
  for (const v of mesh.vertices) {
    const p = transformPoint(matrix, new DVec3(v.x, v.y, v.z));
    const n = transformDirection(matrix, new DVec3(v.nx, v.ny, v.nz));
    let nx = n.x,
      ny = n.y,
      nz = n.z;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-12) {
      nx /= len;
      ny /= len;
      nz /= len;
    }
    v.x = f32(p.x);
    v.y = f32(p.y);
    v.z = f32(p.z);
    v.nx = f32(nx);
    v.ny = f32(ny);
    v.nz = f32(nz);
  }
}

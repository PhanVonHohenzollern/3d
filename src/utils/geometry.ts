import { clamp } from './math';
import type { QPointF, QVector3D } from './Vector3D';

interface Point3 {
  x: number;
  y: number;
  z: number;
}

export function distancePointToSegment(p: QPointF, a: QPointF, b: QPointF): number {
  const ab = b.sub(a);
  const denom = ab.x * ab.x + ab.y * ab.y;
  if (denom <= 1e-9) {
    const d = p.sub(a);

    return Math.sqrt(d.x * d.x + d.y * d.y);
  }

  const ap = p.sub(a);
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / denom, 0, 1);
  const closest = a.add(ab.mul(t));
  const d = p.sub(closest);

  return Math.sqrt(d.x * d.x + d.y * d.y);
}

export function rayTriangleDistance(origin: QVector3D, direction: QVector3D, a: Point3, b: Point3, c: Point3): number {
  const dx = direction.x;
  const dy = direction.y;
  const dz = direction.z;
  const e1x = b.x - a.x;
  const e1y = b.y - a.y;
  const e1z = b.z - a.z;
  const e2x = c.x - a.x;
  const e2y = c.y - a.y;
  const e2z = c.z - a.z;
  const cx = dy * e2z - dz * e2y;
  const cy = dz * e2x - dx * e2z;
  const cz = dx * e2y - dy * e2x;
  const determinant = e1x * cx + e1y * cy + e1z * cz;
  const scale = Math.sqrt((e1x * e1x + e1y * e1y + e1z * e1z) * (e2x * e2x + e2y * e2y + e2z * e2z));
  if (scale === 0 || Math.abs(determinant) <= 1e-8 * scale) return NaN;
  const tx = origin.x - a.x;
  const ty = origin.y - a.y;
  const tz = origin.z - a.z;
  const u = (tx * cx + ty * cy + tz * cz) / determinant;
  if (u < -1e-6 || u > 1 + 1e-6) return NaN;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) / determinant;
  if (v < -1e-6 || u + v > 1 + 1e-6) return NaN;

  return (e2x * qx + e2y * qy + e2z * qz) / determinant;
}

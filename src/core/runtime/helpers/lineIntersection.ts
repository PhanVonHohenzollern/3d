import { FdPoint3d } from '../FdMath';

export function lineIntersection(
  p1: FdPoint3d,
  p2: FdPoint3d,
  q1: FdPoint3d,
  q2: FdPoint3d,
  segments: boolean,
): FdPoint3d | null {
  const u = p2.sub(p1);
  const v = q2.sub(q1);
  const w = p1.sub(q1);
  const a = u.dotProduct(u);
  const b = u.dotProduct(v);
  const c = v.dotProduct(v);
  const d = u.dotProduct(w);
  const e = v.dotProduct(w);
  const den = a * c - b * b;
  if (a <= 1e-12 || c <= 1e-12 || Math.abs(den) <= 1e-12) return null;
  const s = (b * e - c * d) / den;
  const t = (a * e - b * d) / den;
  if (segments && (s < -1e-9 || s > 1.0 + 1e-9 || t < -1e-9 || t > 1.0 + 1e-9)) return null;
  const pa = p1.add(u.mul(s));
  const pb = q1.add(v.mul(t));
  const delta = pa.sub(pb);
  let scale = 1.0;
  for (const length of [u.length(), v.length()]) if (scale < length) scale = length;
  if (delta.length() > 1e-7 * scale) return null;

  return new FdPoint3d((pa.x + pb.x) * 0.5, (pa.y + pb.y) * 0.5, (pa.z + pb.z) * 0.5);
}

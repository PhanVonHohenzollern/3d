import { FdPoint3d } from '@engine/runtime/FdMath';

export function lineIntersection(
  p1: FdPoint3d,
  p2: FdPoint3d,
  q1: FdPoint3d,
  q2: FdPoint3d,
  segments: boolean,
): FdPoint3d | null {
  const coordinates = [p1, p2, q1, q2].flatMap((p) => [p.x, p.y, p.z]);
  if (!coordinates.every(Number.isFinite)) return null;
  const du = p2.sub(p1),
    dv = q2.sub(q1);
  const lu = Math.hypot(du.x, du.y, du.z),
    lv = Math.hypot(dv.x, dv.y, dv.z);
  if (lu === 0 || lv === 0 || !Number.isFinite(lu) || !Number.isFinite(lv)) return null;
  const u = du.div(lu),
    v = dv.div(lv),
    w = q1.sub(p1);
  const normal = u.crossProduct(v),
    den = normal.lengthSqrd();
  if (den <= Number.EPSILON ** 2) return null;
  // Cross products avoid subtracting nearly equal squared dot products for shallow angles.
  const s = w.crossProduct(v).dotProduct(normal) / den;
  const t = w.crossProduct(u).dotProduct(normal) / den;
  if (!Number.isFinite(s) || !Number.isFinite(t)) return null;
  const tolerance = 1e-9 + 32 * Number.EPSILON * Math.max(lu, lv, ...coordinates.map(Math.abs));
  if (segments && (s < -tolerance || s > lu + tolerance || t < -tolerance || t > lv + tolerance)) return null;
  const pa = p1.add(u.mul(s));
  const pb = q1.add(v.mul(t));
  const delta = pa.sub(pb);
  if (delta.length() > tolerance) return null;

  return new FdPoint3d((pa.x + pb.x) * 0.5, (pa.y + pb.y) * 0.5, (pa.z + pb.z) * 0.5);
}

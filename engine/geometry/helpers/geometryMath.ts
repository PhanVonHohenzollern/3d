import { stdClamp, stdMax } from '@engine/runtime/cpp/cppStd';
import { cross, dot, DVec3, length, normalized } from '@engine/math/DVec3';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';

export const kEps = 1e-9;

export function toVec(p: FdPoint3d | FdVector3d): DVec3 {
  return new DVec3(p.x, p.y, p.z);
}

export function toPoint(v: DVec3): FdPoint3d {
  return new FdPoint3d(v.x, v.y, v.z);
}

export function toFdVector(v: DVec3): FdVector3d {
  return new FdVector3d(v.x, v.y, v.z);
}

export function rotateAroundAxis(v: DVec3, axisInput: DVec3, angle: number): DVec3 {
  const axis = normalized(axisInput);
  if (length(axis) <= kEps) return v;
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return v
    .mul(c)
    .add(cross(axis, v).mul(s))
    .add(axis.mul(dot(axis, v) * (1.0 - c)));
}

export function stableBasis(normal: DVec3): [DVec3, DVec3] {
  const n = normalized(normal);
  const helper = Math.abs(n.z) < 0.85 ? new DVec3(0, 0, 1) : new DVec3(0, 1, 0);
  let u = normalized(cross(n, helper));
  if (length(u) <= 1e-12) u = normalized(cross(n, new DVec3(1, 0, 0)));
  const v = normalized(cross(n, u));

  return [u, v];
}

export function basisFromUp(axis: DVec3, upHint: DVec3): [DVec3, DVec3] {
  const n = normalized(axis);
  const projected = upHint.sub(n.mul(dot(upHint, n)));
  if (length(projected) <= 1e-12) {
    return stableBasis(n);
  }
  const u = normalized(projected);
  const v = normalized(cross(n, u));

  return [u, v];
}

export function circularFaceCount(complexity: number): number {
  const faces = stdMax(1, complexity) * 4;

  return stdClamp(faces, 4, 4096);
}

export function sdkPerpVector(direction: FdVector3d): FdVector3d {
  const [u] = stableBasis(toVec(direction));

  return toFdVector(u);
}

export function validDirection(v: FdVector3d): boolean {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) > kEps;
}

export function deg(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// The point at angle t (radians) on the ellipse around `center` with semi-axes a along u and b along v.
export function ellipsePoint(center: DVec3, u: DVec3, v: DVec3, a: number, b: number, t: number): DVec3 {
  return center.add(u.mul(a * Math.cos(t))).add(v.mul(b * Math.sin(t)));
}

export interface ArcSection {
  t: number;
  theta: number;
  center: DVec3;
  normal: DVec3;
}

// count + 1 sections along a circular bend: it starts `lead` along `normal` from `origin`, turns by
// `angle` radians toward `turn`, with radius `along` in the normal direction and `across` toward
// `turn`. Each section has its centre and the rotated normal.
export function sweepAlongArc(
  origin: DVec3,
  normal: DVec3,
  turn: DVec3,
  lead: number,
  along: number,
  across: number,
  angle: number,
  count: number,
): ArcSection[] {
  const axis = normalized(cross(normal, turn));

  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      theta = angle * t;

    return {
      t,
      theta,
      center: origin.add(normal.mul(lead + along * Math.sin(theta))).add(turn.mul(across * (1 - Math.cos(theta)))),
      normal: rotateAroundAxis(normal, axis, theta),
    };
  });
}

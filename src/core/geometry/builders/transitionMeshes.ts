import { stdClamp, stdMax, stdMin, stdSort4, stdSort4Doubles, eraseUnique } from '../../../utils/cppStd';
import { cross, dot, DVec3, length, normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import { basisFromUp, circularFaceCount, kEps, toPoint, toVec } from '../helpers/geometryMath';
import { addTriangle, vertex } from '../helpers/meshData';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewMesh } from '../previewScene';

export function buildRectToEllipseTransitionMesh(
  context: MeshBuildContext,
  rectCorners: FdPoint3d[],
  rectCenter: FdPoint3d,
  normal: FdVector3d,
  upVector: FdVector3d,
  tubeStart: FdPoint3d,
  diamA: number,
  diamB: number,
  complexity: number,
): PreviewMesh {
  const mesh = context.createMesh();

  const n = normalized(toVec(normal));
  if (length(n) <= kEps || diamA <= 0.0 || diamB <= 0.0 || complexity < 1 || rectCorners.length < 4) return mesh;

  const [up, side] = basisFromUp(n, toVec(upVector));
  const ringSegments = circularFaceCount(complexity);
  const tubeC = toVec(tubeStart);
  const rectC = toVec(rectCenter);

  interface P2 {
    x: number;
    y: number;
  }
  const polygon: P2[] = [];
  for (let i = 0; i < 4; ++i) {
    const delta = toVec(rectCorners[i]).sub(rectC);
    polygon.push({ x: dot(delta, up), y: dot(delta, side) });
  }

  stdSort4(polygon, (a, b) => Math.atan2(a.y, a.x) < Math.atan2(b.y, b.x));

  const rayToRectangle = (angle: number): DVec3 => {
    const d: P2 = { x: Math.cos(angle), y: Math.sin(angle) };
    let bestT = 1e100;
    for (let e = 0; e < polygon.length; ++e) {
      const a = polygon[e];
      const b = polygon[(e + 1) % polygon.length];
      const edge: P2 = { x: b.x - a.x, y: b.y - a.y };
      const det = d.x * -edge.y - d.y * -edge.x;
      if (Math.abs(det) <= 1e-12) continue;
      const t = (a.x * -edge.y - a.y * -edge.x) / det;
      const u = (d.x * a.y - d.y * a.x) / det;
      if (t >= -1e-9 && u >= -1e-9 && u <= 1.0 + 1e-9) bestT = stdMin(bestT, stdMax(0.0, t));
    }
    if (!Number.isFinite(bestT) || bestT >= 1e99) return rectC;
    return rectC.add(up.mul(d.x * bestT)).add(side.mul(d.y * bestT));
  };

  const rA = 0.5 * Math.abs(diamA);
  const rB = 0.5 * Math.abs(diamB);

  for (let i = 0; i < ringSegments; ++i) {
    const angle = (2.0 * Math.PI * i) / ringSegments;
    const rectanglePoint = rayToRectangle(angle);
    const ellipseOffset = up.mul(rA * Math.cos(angle)).add(side.mul(rB * Math.sin(angle)));
    const ellipsePoint = tubeC.add(ellipseOffset);
    let wallNormal = normalized(rectanglePoint.sub(rectC).add(ellipsePoint.sub(tubeC)));
    if (length(wallNormal) <= kEps) wallNormal = normalized(ellipseOffset);
    mesh.vertices.push(vertex(rectanglePoint, wallNormal));
    mesh.vertices.push(vertex(ellipsePoint, wallNormal));
  }

  for (let i = 0; i < ringSegments; ++i) {
    const j = (i + 1) % ringSegments;
    const r0 = 2 * i;
    const e0 = r0 + 1;
    const r1 = 2 * j;
    const e1 = r1 + 1;
    addTriangle(mesh, r0, r1, e1);
    addTriangle(mesh, r0, e1, e0);
  }
  return mesh;
}

export function rectangleCorners(
  center: FdPoint3d,
  normal: FdVector3d,
  upVector: FdVector3d,
  height: number,
  width: number,
): FdPoint3d[] {
  const n = normalized(toVec(normal));
  const [up, side] = basisFromUp(n, toVec(upVector));
  const c = toVec(center);
  const hh = 0.5 * Math.abs(height);
  const hw = 0.5 * Math.abs(width);
  return [
    toPoint(c.add(up.mul(hh)).add(side.mul(hw))),
    toPoint(c.sub(up.mul(hh)).add(side.mul(hw))),
    toPoint(c.sub(up.mul(hh)).sub(side.mul(hw))),
    toPoint(c.add(up.mul(hh)).sub(side.mul(hw))),
  ];
}

export function buildRectTubeIntersectionMeshes(
  context: MeshBuildContext,
  start: FdPoint3d,
  normal: FdVector3d,
  upVector: FdVector3d,
  diamA: number,
  diamB: number,
  tubeLength: number,
  offsetLR: number,
  offsetUD: number,
  ductWidth: number,
  ductHeight: number,
  ductLength: number,
  complexity: number,
): [PreviewMesh, PreviewMesh] {
  const meshes: [PreviewMesh, PreviewMesh] = [context.createMesh('.main'), context.createMesh('.duct')];
  const [tube, duct] = meshes;

  const axis = normalized(toVec(normal));
  const [up, side] = basisFromUp(axis, toVec(upVector));
  const p0 = toVec(start);
  const a = diamA * 0.5,
    b = diamB * 0.5;
  const sign = ductLength < 0.0 ? -1.0 : 1.0;
  const outer = Math.abs(ductLength);
  const hole0 = stdClamp(offsetLR - ductWidth * 0.5, 0.0, tubeLength);
  const hole1 = stdClamp(offsetLR + ductWidth * 0.5, 0.0, tubeLength);
  const upMin = stdClamp(offsetUD - ductHeight * 0.5, -a, a);
  const upMax = stdClamp(offsetUD + ductHeight * 0.5, -a, a);
  const segs = circularFaceCount(complexity);

  interface Profile {
    u: number;
    s: number;
  }
  const ring: Profile[] = [];
  for (let i = 0; i < segs; ++i) {
    const angle = (2.0 * Math.PI * i) / segs,
      nextAngle = (2.0 * Math.PI * (i + 1)) / segs;
    const current: Profile = { u: a * Math.cos(angle), s: b * Math.sin(angle) };
    const next: Profile = { u: a * Math.cos(nextAngle), s: b * Math.sin(nextAngle) };
    ring.push(current);
    if (i >= Math.trunc(segs / 2)) continue;
    for (const u of [upMax, upMin]) {
      if (u >= current.u - kEps || u <= next.u + kEps) continue;
      const t = (u - current.u) / (next.u - current.u);
      ring.push({ u, s: current.s + t * (next.s - current.s) });
    }
  }
  const boundaryIndex = (u: number): number => {
    let closest = 0;
    let distance = 1e100;
    for (let i = 0; i < ring.length; ++i) {
      if (ring[i].s < -kEps) continue;
      const delta = Math.abs(ring[i].u - u);
      if (delta < distance) {
        closest = i;
        distance = delta;
      }
    }
    return closest;
  };
  const first = boundaryIndex(upMax),
    last = boundaryIndex(upMin);
  const point = (x: number, i: number, atOuter = false): DVec3 =>
    p0
      .add(axis.mul(x))
      .add(up.mul(ring[i].u))
      .add(side.mul(sign * (atOuter ? outer : ring[i].s)));
  const stations = [0.0, hole0, hole1, tubeLength];
  stdSort4Doubles(stations);
  eraseUnique(stations);
  for (const x of stations) {
    for (let i = 0; i < ring.length; ++i) {
      const r = ring[i];
      const radialNormal = normalized(up.mul(r.u / (a * a)).add(side.mul((sign * r.s) / (b * b))));
      tube.vertices.push(vertex(point(x, i), radialNormal));
    }
  }
  for (let r = 0; r + 1 < stations.length; ++r) {
    const axialHole = stations[r] >= hole0 && stations[r + 1] <= hole1;
    for (let i = 0; i < ring.length; ++i) {
      if (axialHole && i >= first && i < last) continue;
      const j = (i + 1) % ring.length;
      const a0 = r * ring.length + i;
      const b0 = r * ring.length + j;
      const c0 = (r + 1) * ring.length + j;
      const d0 = (r + 1) * ring.length + i;
      if (sign > 0) {
        addTriangle(tube, a0, b0, c0);
        addTriangle(tube, a0, c0, d0);
      } else {
        addTriangle(tube, a0, c0, b0);
        addTriangle(tube, a0, d0, c0);
      }
    }
  }
  const wall = (a0: DVec3, b0: DVec3, c0: DVec3, d0: DVec3, n: DVec3) => {
    const index = duct.vertices.length;
    for (const p of [a0, b0, c0, d0]) duct.vertices.push(vertex(p, n));
    if (dot(cross(b0.sub(a0), c0.sub(a0)), n) > 0) {
      addTriangle(duct, index, index + 1, index + 2);
      addTriangle(duct, index, index + 2, index + 3);
    } else {
      addTriangle(duct, index, index + 2, index + 1);
      addTriangle(duct, index, index + 3, index + 2);
    }
  };
  for (let i = first; i < last; ++i) {
    wall(point(hole0, i), point(hole0, i + 1), point(hole0, i + 1, true), point(hole0, i, true), axis.mul(-1));
    wall(point(hole1, i), point(hole1, i + 1), point(hole1, i + 1, true), point(hole1, i, true), axis);
  }
  wall(point(hole0, first), point(hole1, first), point(hole1, first, true), point(hole0, first, true), up);
  wall(point(hole0, last), point(hole1, last), point(hole1, last, true), point(hole0, last, true), up.mul(-1));
  return meshes;
}

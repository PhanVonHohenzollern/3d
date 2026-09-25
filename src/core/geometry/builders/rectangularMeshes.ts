import { cross, dot, DVec3, length, normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import { basisFromUp, kEps, stableBasis, toVec } from '../helpers/geometryMath';
import { addTriangle, vertex } from '../helpers/meshData';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewMesh } from '../previewScene';

export function buildConnectorFlangeMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  upVector: FdVector3d,
  width: number,
  height: number,
  connectorWidth: number,
  sideCode: number,
  directionSign: number,
): PreviewMesh {
  const mesh = context.createMesh();
  if (sideCode === 5 || width <= 0.0 || height <= 0.0 || connectorWidth <= 0.0) return mesh;

  const n = normalized(toVec(normal));
  if (length(n) <= kEps) return mesh;
  const [up, right] = basisFromUp(n, toVec(upVector));
  const c = toVec(center);
  const faceNormal = directionSign < 0.0 ? n.mul(-1.0) : n;
  const hw = Math.abs(width) * 0.5;
  const hh = Math.abs(height) * 0.5;

  const appendPerimeter = (halfWidth: number, halfHeight: number) => {
    mesh.vertices.push(vertex(c.add(right.mul(halfWidth)).add(up.mul(halfHeight)), faceNormal));
    mesh.vertices.push(vertex(c.sub(right.mul(halfWidth)).add(up.mul(halfHeight)), faceNormal));
    mesh.vertices.push(vertex(c.sub(right.mul(halfWidth)).sub(up.mul(halfHeight)), faceNormal));
    mesh.vertices.push(vertex(c.add(right.mul(halfWidth)).sub(up.mul(halfHeight)), faceNormal));
  };

  // connectorWidth expands the rim in the section plane; it does not extend
  // the box along its normal. Keep the inner opening and join it to the rim.
  appendPerimeter(hw, hh);
  appendPerimeter(hw + connectorWidth, hh + connectorWidth);

  const visible = (side: number): boolean => {
    if (sideCode === 0) return true;
    if (sideCode >= 1 && sideCode <= 4) return side === sideCode - 1;
    if (sideCode === 24) return side === 1 || side === 3;
    if (sideCode === 13) return side === 0 || side === 2;

    return false;
  };

  for (let side = 0; side < 4; ++side) {
    if (!visible(side)) continue;
    const next = (side + 1) % 4;
    const a = side;
    const b = next;
    const c = 4 + next;
    const d = 4 + side;
    if (directionSign < 0.0) {
      addTriangle(mesh, a, c, b);
      addTriangle(mesh, a, d, c);
    } else {
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  return mesh;
}

export function buildRectFaceMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  upVector: FdVector3d,
  height: number,
  width: number,
): PreviewMesh {
  const mesh = context.createMesh();

  const n = normalized(toVec(normal));
  let up = toVec(upVector).sub(n.mul(dot(toVec(upVector), n)));
  if (length(up) <= kEps) {
    const [, v] = stableBasis(n);
    up = v;
  } else up = normalized(up);
  const right = normalized(cross(n, up));
  const c = toVec(center);
  const hh = Math.abs(height) * 0.5;
  const hw = Math.abs(width) * 0.5;
  mesh.vertices = [
    vertex(c.add(right.mul(hw)).add(up.mul(hh)), n),
    vertex(c.sub(right.mul(hw)).add(up.mul(hh)), n),
    vertex(c.sub(right.mul(hw)).sub(up.mul(hh)), n),
    vertex(c.add(right.mul(hw)).sub(up.mul(hh)), n),
  ];
  addTriangle(mesh, 0, 1, 2);
  addTriangle(mesh, 0, 2, 3);

  return mesh;
}

export function buildBoxMesh(
  context: MeshBuildContext,
  count: number,
  centers: FdPoint3d[],
  normals: FdVector3d[],
  upVectors: FdVector3d[],
  widths: number[],
  heights: number[],
  sides: boolean[],
  beginning: boolean,
  endCap: boolean,
): PreviewMesh {
  const mesh = context.createMesh();

  const sections = count + 1;
  const corners: DVec3[] = [];

  for (let s = 0; s < sections; ++s) {
    let normal = normalized(toVec(normals[s]));
    let up = normalized(toVec(upVectors[s]));
    if (length(normal) <= kEps && s + 1 < sections) normal = normalized(toVec(centers[s + 1]).sub(toVec(centers[s])));
    if (length(up) <= kEps) up = new DVec3(0, 0, 1);
    up = up.sub(normal.mul(dot(up, normal)));
    if (length(up) <= kEps) {
      const [, fallbackV] = stableBasis(normal);
      up = fallbackV;
    } else up = normalized(up);
    let right = normalized(cross(normal, up));
    if (length(right) <= kEps) {
      const [fallbackU, fallbackV] = stableBasis(normal);
      right = fallbackU;
      up = fallbackV;
    }

    const hw = Math.abs(widths[s]) * 0.5;
    const hh = Math.abs(heights[s]) * 0.5;
    const c = toVec(centers[s]);
    corners.push(c.add(right.mul(hw)).add(up.mul(hh)));
    corners.push(c.sub(right.mul(hw)).add(up.mul(hh)));
    corners.push(c.sub(right.mul(hw)).sub(up.mul(hh)));
    corners.push(c.add(right.mul(hw)).sub(up.mul(hh)));
  }

  for (let s = 0; s < sections; ++s) {
    const n = normalized(toVec(normals[s]));
    for (let k = 0; k < 4; ++k) mesh.vertices.push(vertex(corners[s * 4 + k], n));
  }

  for (let s = 0; s < count; ++s) {
    for (let side = 0; side < 4; ++side) {
      const sideIndex = s * 4 + side;
      if (sideIndex < sides.length && !sides[sideIndex]) continue;
      const nextSide = (side + 1) % 4;
      const a = s * 4 + side;
      const b = s * 4 + nextSide;
      const c = (s + 1) * 4 + nextSide;
      const d = (s + 1) * 4 + side;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  if (beginning) {
    addTriangle(mesh, 0, 2, 1);
    addTriangle(mesh, 0, 3, 2);
  }
  if (endCap) {
    const base = count * 4;
    addTriangle(mesh, base, base + 1, base + 2);
    addTriangle(mesh, base, base + 2, base + 3);
  }

  return mesh;
}

export function buildPolygonFaceMesh(context: MeshBuildContext, points: FdPoint3d[]): PreviewMesh {
  const mesh = context.createMesh();
  if (points.length < 3) return mesh;

  let n = new DVec3(0, 0, 1);
  for (let i = 2; i < points.length; ++i) {
    const candidate = cross(toVec(points[i - 1]).sub(toVec(points[0])), toVec(points[i]).sub(toVec(points[0])));
    if (length(candidate) > kEps) {
      n = normalized(candidate);
      break;
    }
  }
  for (const p of points) mesh.vertices.push(vertex(toVec(p), n));
  for (let i = 1; i + 1 < points.length; ++i) addTriangle(mesh, 0, i, i + 1);

  return mesh;
}

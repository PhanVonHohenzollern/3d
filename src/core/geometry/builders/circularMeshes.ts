import { stdClamp, stdMax, stdMin, llroundToInt } from '../../../utils/cppStd';
import { cross, dot, length, normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import { basisFromUp, circularFaceCount, kEps, rotateAroundAxis, stableBasis, toVec } from '../helpers/geometryMath';
import { addTriangle, vertex } from '../helpers/meshData';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewMesh } from '../previewScene';

export function buildTaperedTubeMesh(
  context: MeshBuildContext,
  start: FdPoint3d,
  end: FdPoint3d,
  diameter1: number,
  diameter2: number,
  segments: number,
): PreviewMesh {
  const mesh = context.createMesh();

  segments = circularFaceCount(segments);
  const r0 = diameter1 * 0.5;
  const r1 = diameter2 * 0.5;
  const p0 = toVec(start);
  const p1 = toVec(end);
  const axis = normalized(p1.sub(p0));
  const [u, v] = stableBasis(axis);

  for (let ring = 0; ring < 2; ++ring) {
    const center = ring === 0 ? p0 : p1;
    const radius = ring === 0 ? r0 : r1;
    for (let i = 0; i < segments; ++i) {
      const angle = (2.0 * Math.PI * i) / segments;
      const radial = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)));
      mesh.vertices.push(vertex(center.add(radial.mul(radius)), radial));
    }
  }

  for (let i = 0; i < segments; ++i) {
    const next = (i + 1) % segments;
    const a = i;
    const b = next;
    const c = segments + next;
    const d = segments + i;
    addTriangle(mesh, a, b, c);
    addTriangle(mesh, a, c, d);
  }

  return mesh;
}

export function buildDiscMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  diameter: number,
  segments: number,
): PreviewMesh {
  const mesh = context.createMesh();

  segments = circularFaceCount(segments);
  const c = toVec(center);
  const n = normalized(toVec(normal));
  const [u, v] = stableBasis(n);
  const radius = diameter * 0.5;

  mesh.vertices.push(vertex(c, n));
  for (let i = 0; i < segments; ++i) {
    const angle = (2.0 * Math.PI * i) / segments;
    mesh.vertices.push(
      vertex(
        c.add(
          u
            .mul(Math.cos(angle))
            .add(v.mul(Math.sin(angle)))
            .mul(radius),
        ),
        n,
      ),
    );
  }
  for (let i = 0; i < segments; ++i) {
    const a = 0;
    const b = 1 + i;
    const cidx = 1 + ((i + 1) % segments);
    addTriangle(mesh, a, b, cidx);
  }

  return mesh;
}

export function buildRingMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  innerDiameter: number,
  outerDiameter: number,
  segments: number,
): PreviewMesh {
  const mesh = context.createMesh();

  segments = circularFaceCount(segments);
  const c = toVec(center);
  const n = normalized(toVec(normal));
  const [u, v] = stableBasis(n);
  const ri = stdMin(Math.abs(innerDiameter), Math.abs(outerDiameter)) * 0.5;
  const ro = stdMax(Math.abs(innerDiameter), Math.abs(outerDiameter)) * 0.5;

  for (let i = 0; i < segments; ++i) {
    const angle = (2.0 * Math.PI * i) / segments;
    const radial = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)));
    mesh.vertices.push(vertex(c.add(radial.mul(ri)), n));
    mesh.vertices.push(vertex(c.add(radial.mul(ro)), n));
  }
  for (let i = 0; i < segments; ++i) {
    const j = (i + 1) % segments;
    const i0 = 2 * i;
    const o0 = i0 + 1;
    const i1 = 2 * j;
    const o1 = i1 + 1;
    addTriangle(mesh, i0, o0, o1);
    addTriangle(mesh, i0, o1, i1);
  }

  return mesh;
}

export function buildCircleOutlineMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  diameter: number,
): PreviewMesh {
  const outer = Math.abs(diameter);
  const lineWidth = stdMax(outer * 0.025, 0.05);
  const mesh = buildRingMesh(context, center, normal, stdMax(0.0, outer - lineWidth * 2.0), outer, 12);

  return mesh;
}

export function buildFacettedCylinderMesh(
  context: MeshBuildContext,
  start: FdPoint3d,
  end: FdPoint3d,
  upVector: FdVector3d,
  diameter: number,
  startAngleDeg: number,
  endAngleDeg: number,
  complexity: number,
  front: boolean,
  back: boolean,
): PreviewMesh {
  const mesh = context.createMesh();

  const p0 = toVec(start);
  const p1 = toVec(end);
  const axis = normalized(p1.sub(p0));
  const [u, v] = basisFromUp(axis, toVec(upVector));

  let sweepDeg = endAngleDeg - startAngleDeg;
  if (Math.abs(sweepDeg) <= 1e-9) sweepDeg = 360.0;
  const closedSweep = Math.abs(sweepDeg) >= 359.999;
  const sweepFraction = stdMin(1.0, Math.abs(sweepDeg) / 360.0);
  let facetCount = stdMax(1, llroundToInt(complexity * sweepFraction));
  if (closedSweep) facetCount = stdMax(3, complexity);
  facetCount = stdClamp(facetCount, 1, 2048);
  const ringCount = closedSweep ? facetCount : facetCount + 1;
  const radius = diameter * 0.5;

  for (let ring = 0; ring < 2; ++ring) {
    const center = ring === 0 ? p0 : p1;
    for (let i = 0; i < ringCount; ++i) {
      const t = closedSweep ? i / facetCount : i / facetCount;
      const angle = ((startAngleDeg + sweepDeg * t) * Math.PI) / 180.0;
      const radial = u.mul(Math.cos(angle)).add(v.mul(Math.sin(angle)));
      mesh.vertices.push(vertex(center.add(radial.mul(radius)), radial));
    }
  }

  const sideSegments = closedSweep ? facetCount : facetCount;
  for (let i = 0; i < sideSegments; ++i) {
    const next = closedSweep ? (i + 1) % ringCount : i + 1;
    const a = i;
    const b = next;
    const c = ringCount + next;
    const d = ringCount + i;
    addTriangle(mesh, a, b, c);
    addTriangle(mesh, a, c, d);
  }

  const addCap = (enabled: boolean, atEnd: boolean) => {
    if (!enabled) return;
    const center = atEnd ? p1 : p0;
    const capNormal = atEnd ? axis : axis.mul(-1.0);
    const centerIndex = mesh.vertices.length;
    mesh.vertices.push(vertex(center, capNormal));
    const base = atEnd ? ringCount : 0;
    for (let i = 0; i < sideSegments; ++i) {
      const next = closedSweep ? (i + 1) % ringCount : i + 1;
      const a = base + i;
      const b = base + next;
      if (atEnd) addTriangle(mesh, centerIndex, a, b);
      else addTriangle(mesh, centerIndex, b, a);
    }
  };

  addCap(front, false);
  addCap(back, true);

  return mesh;
}

export function buildSectionTubeMesh(
  context: MeshBuildContext,
  centers: FdPoint3d[],
  normals: FdVector3d[],
  upVectors: FdVector3d[],
  diameters: number[][],
  complexity: number,
  numOfSegs: number,
  half: boolean,
): PreviewMesh {
  const mesh = context.createMesh();

  const sections = numOfSegs + 1;
  const ringSegments = circularFaceCount(complexity);
  const ringPoints = half ? ringSegments + 1 : ringSegments;
  const sweep = half ? Math.PI : 2.0 * Math.PI;

  for (let section = 0; section < sections; ++section) {
    let n = normalized(toVec(normals[section]));
    if (length(n) <= kEps) {
      if (section + 1 < sections) n = normalized(toVec(centers[section + 1]).sub(toVec(centers[section])));
      else if (section > 0) n = normalized(toVec(centers[section]).sub(toVec(centers[section - 1])));
    }
    const [up, side] = basisFromUp(n, toVec(upVectors[section]));
    const rUp = Math.abs(diameters[section][0]) * 0.5;
    const rSide = Math.abs(diameters[section][1]) * 0.5;
    const c = toVec(centers[section]);
    for (let i = 0; i < ringPoints; ++i) {
      const t = half ? i / ringSegments : i / ringSegments;
      const angle = sweep * t;
      const radial = up.mul(Math.cos(angle) * rUp).add(side.mul(Math.sin(angle) * rSide));
      mesh.vertices.push(vertex(c.add(radial), normalized(radial)));
    }
  }

  for (let section = 0; section < numOfSegs; ++section) {
    for (let i = 0; i < ringSegments; ++i) {
      const next = half ? i + 1 : (i + 1) % ringPoints;
      const a = section * ringPoints + i;
      const b = section * ringPoints + next;
      const c = (section + 1) * ringPoints + next;
      const d = (section + 1) * ringPoints + i;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  return mesh;
}

export function buildTorusSectionMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  radVec: FdVector3d,
  radius: number,
  diameter: number,
  sweepAngleDeg: number,
  complexity: number,
  segmentation: number,
): PreviewMesh {
  const mesh = context.createMesh();

  const axis = normalized(toVec(normal));
  let radial0 = toVec(radVec).sub(axis.mul(dot(toVec(radVec), axis)));
  if (length(radial0) <= kEps) {
    const [u] = stableBasis(axis);
    radial0 = u;
  } else radial0 = normalized(radial0);

  const crossSegments = circularFaceCount(complexity);
  const sweepSegments = stdClamp(stdMax(1, segmentation), 1, 1024);
  const closed = Math.abs(sweepAngleDeg) >= 359.999;
  const sweepPoints = closed ? sweepSegments : sweepSegments + 1;
  const sweep = (sweepAngleDeg * Math.PI) / 180.0;
  const tubeRadius = Math.abs(diameter) * 0.5;
  const c0 = toVec(center);

  for (let s = 0; s < sweepPoints; ++s) {
    const t = closed ? s / sweepSegments : s / sweepSegments;
    const angle = sweep * t;
    const radial = normalized(rotateAroundAxis(radial0, axis, angle));
    const ringCenter = c0.add(radial.mul(radius));
    for (let j = 0; j < crossSegments; ++j) {
      const phi = (2.0 * Math.PI * j) / crossSegments;
      const offsetDir = normalized(radial.mul(Math.cos(phi)).add(axis.mul(Math.sin(phi))));
      mesh.vertices.push(vertex(ringCenter.add(offsetDir.mul(tubeRadius)), offsetDir));
    }
  }

  const longitudinalSegments = closed ? sweepSegments : sweepSegments;
  for (let s = 0; s < longitudinalSegments; ++s) {
    const sn = closed ? (s + 1) % sweepPoints : s + 1;
    for (let j = 0; j < crossSegments; ++j) {
      const jn = (j + 1) % crossSegments;
      const a = s * crossSegments + j;
      const b = s * crossSegments + jn;
      const c = sn * crossSegments + jn;
      const d = sn * crossSegments + j;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  return mesh;
}

export function buildSpheroidSectionMesh(
  context: MeshBuildContext,
  center: FdPoint3d,
  normal: FdVector3d,
  bVector: FdVector3d,
  latAngles: number[],
  longAngles: number[],
  diameters: number[],
  complexity: number[],
): PreviewMesh {
  const mesh = context.createMesh();

  const aAxis = normalized(toVec(normal));
  let bAxis = toVec(bVector).sub(aAxis.mul(dot(toVec(bVector), aAxis)));
  if (length(bAxis) <= kEps) {
    const [u] = stableBasis(aAxis);
    bAxis = u;
  } else {
    bAxis = normalized(bAxis);
  }
  const cAxis = normalized(cross(aAxis, bAxis));
  const centroid = toVec(center);

  const rA = Math.abs(diameters[0]) * 0.5;
  const rB = Math.abs(diameters[1]) * 0.5;
  const rC = Math.abs(diameters[2]) * 0.5;
  const latSteps = stdClamp(stdMax(1, complexity[0]), 1, 512);
  const lonSteps = stdClamp(stdMax(1, complexity[1]), 1, 1024);
  const lat0 = (latAngles[0] * Math.PI) / 180.0;
  const lat1 = (latAngles[1] * Math.PI) / 180.0;
  const lon0 = (longAngles[0] * Math.PI) / 180.0;
  const lon1 = (longAngles[1] * Math.PI) / 180.0;

  for (let i = 0; i <= latSteps; ++i) {
    const u = i / latSteps;
    const lat = lat0 + (lat1 - lat0) * u;
    const sl = Math.sin(lat);
    const cl = Math.cos(lat);
    for (let j = 0; j <= lonSteps; ++j) {
      const v = j / lonSteps;
      const lon = lon0 + (lon1 - lon0) * v;
      const co = Math.cos(lon);
      const so = Math.sin(lon);

      const local = aAxis
        .mul(-rA * cl)
        .add(bAxis.mul(rB * sl * co))
        .add(cAxis.mul(rC * sl * so));
      const surfaceNormal = aAxis
        .mul(rA > kEps ? -cl / rA : 0.0)
        .add(bAxis.mul(rB > kEps ? (sl * co) / rB : 0.0))
        .add(cAxis.mul(rC > kEps ? (sl * so) / rC : 0.0));
      mesh.vertices.push(vertex(centroid.add(local), normalized(surfaceNormal)));
    }
  }

  const stride = lonSteps + 1;
  for (let i = 0; i < latSteps; ++i) {
    for (let j = 0; j < lonSteps; ++j) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j + 1;
      const d = (i + 1) * stride + j;
      addTriangle(mesh, a, b, c);
      addTriangle(mesh, a, c, d);
    }
  }

  return mesh;
}

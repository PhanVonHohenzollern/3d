import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildSectionTubeMesh } from '../builders/circularMeshes';
import { buildPolygonFaceMesh } from '../builders/rectangularMeshes';
import { warningFor } from '../helpers/apiCall';
import { sdkPerpVector } from '../helpers/geometryMath';
import { pointArray } from '../helpers/valueDecoding';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendTube } from './tubeAdapters';
import { cross, dot, DVec3, normalized } from '../../../utils/DVec3';
import { vertex } from '../helpers/meshData';

export function appendRotatablePlane(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const points: FdPoint3d[] = [];
  if (
    !pointArray(args[0], points) ||
    points.length < 4 ||
    !(args[1] instanceof FdVector3d) ||
    !(args[2] instanceof FdPoint3d)
  )
    return false;
  const axis = args[1],
    center = args[2],
    angle = (Number(args[3]) * Math.PI) / 180;
  if (!axis.length() || !Number.isFinite(angle)) {
    scene.warnings.push(warningFor(context.call, 'invalid plane rotation'));

    return true;
  }
  scene.meshes.push(
    buildPolygonFaceMesh(
      context,
      points.slice(0, 4).map((p) => p.rotateBy(angle, axis, center)),
    ),
  );

  return true;
}

export function appendElbowedTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const points: FdPoint3d[] = [];
  const diameter = Number(args[1]),
    complexity = Number(args[2]),
    count = Number(args[3]);
  if (!pointArray(args[0], points)) return false;
  if (diameter <= 0 || complexity < 1 || count < 1 || count >= points.length || !Number.isInteger(count)) {
    scene.warnings.push(warningFor(context.call, 'invalid elbowed tube dimensions/count'));

    return true;
  }
  const normals = points.slice(0, count + 1).map((p, i) =>
    i === 0
      ? points[1].sub(p).normal()
      : i === count
        ? p.sub(points[i - 1]).normal()
        : p
            .sub(points[i - 1])
            .normal()
            .add(points[i + 1].sub(p).normal())
            .normal(),
  );
  if (normals.some((n) => n.length() === 0)) {
    scene.warnings.push(warningFor(context.call, 'coincident points or reversing elbow path'));

    return true;
  }
  scene.meshes.push(
    buildSectionTubeMesh(
      context,
      points,
      normals,
      normals.map(sdkPerpVector),
      normals.map(() => [diameter, diameter]),
      complexity,
      count,
      false,
    ),
  );

  return true;
}

export function appendTruncatedTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (!(args[8] instanceof FdPoint3d) || !(args[9] instanceof FdVector3d)) return false;
  const origin = new DVec3(args[8].x, args[8].y, args[8].z),
    normal = normalized(new DVec3(args[9].x, args[9].y, args[9].z));
  if (dot(normal, normal) < 1e-9) {
    scene.warnings.push(warningFor(context.call, 'zero truncation normal'));

    return true;
  }
  const temporary: PreviewGeometryScene = { meshes: [], warnings: [] };
  appendTube(temporary, context, args.slice(0, 8));
  scene.warnings.push(...temporary.warnings);
  const mesh = context.createMesh();
  for (const source of temporary.meshes)
    for (let k = 0; k < source.indices.length; k += 3) {
      const points = source.indices.slice(k, k + 3).map((i) => {
        const p = source.vertices[i];

        return new DVec3(p.x, p.y, p.z);
      });
      const clipped: DVec3[] = [];
      for (let i = 0; i < 3; ++i) {
        const p = points[i],
          q = points[(i + 1) % 3],
          d = dot(p.sub(origin), normal),
          e = dot(q.sub(origin), normal);
        if (d <= 0) clipped.push(p);
        if (d <= 0 !== e <= 0) clipped.push(p.add(q.sub(p).mul(d / (d - e))));
      }
      const start = mesh.vertices.length;
      const n = normalized(cross(points[1].sub(points[0]), points[2].sub(points[0])));
      mesh.vertices.push(...clipped.map((p) => vertex(p, n)));
      for (let j = 1; j + 1 < clipped.length; ++j) mesh.indices.push(start, start + j, start + j + 1);
    }
  if (mesh.indices.length) scene.meshes.push(mesh);

  return true;
}

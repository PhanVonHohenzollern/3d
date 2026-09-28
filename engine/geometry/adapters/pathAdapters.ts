import { cross, dot, DVec3, normalized } from '@engine/math/DVec3';
import { buildSectionTubeMesh } from '@engine/geometry/builders/circularMeshes';
import { buildPolygonFaceMesh } from '@engine/geometry/builders/rectangularMeshes';
import { appendSectionTube } from '@engine/geometry/builders/sectionTubes';
import { namedAdapter } from '@engine/geometry/helpers/adapterErrors';
import { deg, sdkPerpVector } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable } from '@engine/geometry/adapters/types';

// The makeTube parameters that makeTruncatedTube starts with, in the shared builder's order.

function appendRotatablePlane(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const points = a.pointArray('points');
  if (points.length < 4) throw new Error('points must contain four points');
  const axis = a.fdVector('rotAxisVector'),
    center = a.point('rotPoint'),
    angle = deg(a.real('alpha'));
  if (!axis.length() || !Number.isFinite(angle)) throw new Error('invalid plane rotation');
  scene.meshes.push(
    buildPolygonFaceMesh(
      context,
      points.slice(0, 4).map((p) => p.rotateBy(angle, axis, center)),
    ),
  );
}

function appendElbowedTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const points = a.pointArray('centerPoints');
  const diameter = a.real('diam'),
    complexity = a.real('n'),
    count = a.real('numOfSegs');
  if (diameter <= 0 || complexity < 1 || count < 1 || count >= points.length || !Number.isInteger(count))
    throw new Error('invalid elbowed tube dimensions/count');
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
  if (normals.some((n) => n.length() === 0)) throw new Error('coincident points or reversing elbow path');
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
}

// makeTube, clipped to the half space behind the plane through centerTr facing normalTr.
function appendTruncatedTube(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const centerTr = a.point('centerTr'),
    normalTr = a.fdVector('normalTr');
  const origin = new DVec3(centerTr.x, centerTr.y, centerTr.z),
    normal = normalized(new DVec3(normalTr.x, normalTr.y, normalTr.z));
  if (dot(normal, normal) < 1e-9) throw new Error('zero truncation normal');
  const temporary: PreviewGeometryScene = { meshes: [], warnings: [] };
  appendSectionTube(temporary, context, a);
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
}

export const pathAdapters: AdapterTable = {
  makeElbowedTube: namedAdapter('invalid elbowed tube', appendElbowedTube),
  makeTruncatedTube: namedAdapter('invalid truncated tube', appendTruncatedTube),
  makeRotatablePlane: namedAdapter('invalid rotatable plane', appendRotatablePlane),
};

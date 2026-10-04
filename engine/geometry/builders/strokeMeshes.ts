import { cross, DVec3, length, normalized } from '@engine/math';
import { kDashFill, kDashLength, kMaxDashes, kStrokeHalfWidth } from '@engine/geometry/config/previewConstants';
import { stableBasis } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

function* strokeSegments(points: DVec3[], closed: boolean, dashed: boolean): Generator<[DVec3, DVec3]> {
  const count = Math.max(0, points.length - 1 + Number(closed));
  if (!dashed) {
    for (let i = 0; i < count; ++i) yield [points[i], points[(i + 1) % points.length]];

    return;
  }
  const lengths = Array.from({ length: count }, (_, i) => length(points[(i + 1) % points.length].sub(points[i])));
  const total = lengths.reduce((sum, distance) => sum + distance, 0);
  if (!Number.isFinite(total)) throw new Error('stroke length must be finite');
  if (total < 1e-9) return;
  const dashes = Math.max(2, Math.min(kMaxDashes, Math.ceil(total / kDashLength)));
  const period = total / (dashes - 1 + kDashFill);
  let distance = 0;
  for (let i = 0; i < count; ++i) {
    const start = distance;
    distance += lengths[i];
    if (lengths[i] < 1e-9) continue;
    const delta = points[(i + 1) % points.length].sub(points[i]);
    const first = Math.max(0, Math.ceil(start / period - kDashFill));
    const last = Math.min(dashes - 1, Math.floor(distance / period));
    for (let dash = first; dash <= last; ++dash) {
      const from = Math.max(start, dash * period),
        to = Math.min(distance, (dash + kDashFill) * period);
      if (to - from < 1e-9) continue;
      yield [
        points[i].add(delta.mul((from - start) / lengths[i])),
        points[i].add(delta.mul((to - start) / lengths[i])),
      ];
    }
  }
}

export function appendStroke(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  points: DVec3[],
  closed = false,
  dashed = false,
): void {
  const mesh = context.createMesh();
  if (dashed) mesh.primitive = 'lines';
  for (const [a, b] of strokeSegments(points, closed, dashed)) {
    const axis = b.sub(a);
    if (length(axis) < 1e-9) continue;
    if (dashed) {
      const start = mesh.vertices.length;
      mesh.vertices.push(vertex(a, new DVec3()), vertex(b, new DVec3()));
      mesh.indices.push(start, start + 1);
      continue;
    }
    const [u, v] = stableBasis(normalized(axis));
    // Two crossed ribbons keep a line visible when viewed edge-on.
    for (const offset of [u.mul(kStrokeHalfWidth), v.mul(kStrokeHalfWidth)]) {
      const start = mesh.vertices.length;
      const normal = normalized(cross(axis, offset));
      mesh.vertices.push(...[a.sub(offset), b.sub(offset), b.add(offset), a.add(offset)].map((p) => vertex(p, normal)));
      mesh.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }
  if (mesh.indices.length) scene.meshes.push(mesh);
}

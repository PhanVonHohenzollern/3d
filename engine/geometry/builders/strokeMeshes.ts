import { cross, DVec3, length, normalized } from '@engine/math/DVec3';
import { kStrokeHalfWidth } from '@engine/geometry/config/previewConstants';
import { stableBasis } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// Symbols are narrow ribbons in the preview's triangle-only renderer. Their
// centre lines retain SDK coordinates; stroke width is a display property.
export function appendStroke(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  points: DVec3[],
  closed = false,
): void {
  const mesh = context.createMesh();
  for (let i = 1; i < points.length + Number(closed); ++i) {
    const a = points[i - 1],
      b = points[i % points.length];
    const axis = b.sub(a);
    if (length(axis) < 1e-9) continue;
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

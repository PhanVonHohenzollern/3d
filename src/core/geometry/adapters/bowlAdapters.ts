import earcut from 'earcut';
import { cross, dot, DVec3, length, normalized } from '../../../utils/DVec3';
import { FdBowlFace, FdBowlInfo } from '../../runtime/FdBowlData';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { warningFor } from '../helpers/apiCall';
import { stableBasis, toVec } from '../helpers/geometryMath';
import { vertex } from '../helpers/meshData';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene, PreviewMesh } from '../previewScene';

function contour(face: FdBowlFace, steps: number): DVec3[] {
  const corners = face.corners;
  if (corners.length < 3) throw new Error('bowl face requires at least three corners');

  return corners.flatMap((corner, i) => {
    const p = toVec(corner.vertex);
    const before = toVec(corners[(i + corners.length - 1) % corners.length].vertex).sub(p);
    const after = toVec(corners[(i + 1) % corners.length].vertex).sub(p);
    const r1 = Math.min(Math.max(0, corner.radii[0]), length(before) / 2);
    const r2 = Math.min(Math.max(0, corner.radii[1]), length(after) / 2);

    return Array.from({ length: steps + 1 }, (_, j) => {
      if (corner.truncated || r1 === 0 || r2 === 0) return p;
      const t = ((j / steps) * Math.PI) / 2;

      return p.add(normalized(before).mul(r1 * (1 - Math.sin(t)))).add(normalized(after).mul(r2 * (1 - Math.cos(t))));
    });
  });
}

function triangle(mesh: PreviewMesh, a: DVec3, b: DVec3, c: DVec3, reverse = false): void {
  if (reverse) [b, c] = [c, b];
  const n = normalized(cross(b.sub(a), c.sub(a)));
  if (length(n) < 1e-9) return;
  const start = mesh.vertices.length;
  mesh.vertices.push(vertex(a, n), vertex(b, n), vertex(c, n));
  mesh.indices.push(start, start + 1, start + 2);
}

function cap(mesh: PreviewMesh, outer: DVec3[], hole: DVec3[] | undefined, normal: DVec3): void {
  const [u, v] = stableBasis(normal);
  const points = hole ? [...outer, ...hole] : outer;
  const flat = points.flatMap((p) => [dot(p, u), dot(p, v)]);
  const indices = earcut(flat, hole ? [outer.length] : undefined, 2);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => points[index]);
    triangle(mesh, a, b, c, dot(cross(b.sub(a), c.sub(a)), normal) < 0);
  }
}

function loft(mesh: PreviewMesh, bowl: FdBowlInfo, reverse: boolean, caps: boolean): DVec3[][] {
  if (bowl.faces[0].corners.length !== bowl.faces[1].corners.length)
    throw new Error('bowl faces have different corner counts');
  const steps = Math.max(1, Math.min(64, Math.trunc(bowl.complexityR)));
  const top = contour(bowl.faces[0], steps),
    bottom = contour(bowl.faces[1], steps);
  const up = normalized(toVec(bowl.faces[0].upVector));
  const divisions = Math.max(1, Math.min(64, Math.trunc(bowl.complexityV)));
  const rings = Array.from({ length: divisions + 1 }, (_, row) =>
    top.map((p, index) => {
      const delta = bottom[index].sub(p),
        t = row / divisions;
      const kind = bowl.faces[0].corners[Math.floor(index / (steps + 1))].trType;
      if (kind === 0) return p.add(delta.mul(t));
      const axial = up.mul(dot(delta, up)),
        lateral = delta.sub(axial);

      return p.add(axial.mul(Math.sin((t * Math.PI) / 2))).add(lateral.mul(1 - Math.cos((t * Math.PI) / 2)));
    }),
  );
  for (let row = 0; row < divisions; ++row)
    for (let i = 0; i < top.length; ++i) {
      const j = (i + 1) % top.length;
      triangle(mesh, rings[row][i], rings[row + 1][i], rings[row + 1][j], reverse);
      triangle(mesh, rings[row][i], rings[row + 1][j], rings[row][j], reverse);
    }
  if (caps) {
    if (bowl.faces[0].cover) cap(mesh, top, undefined, up.mul(reverse ? -1 : 1));
    if (bowl.faces[1].cover) cap(mesh, bottom, undefined, up.mul(reverse ? 1 : -1));
  }

  return [top, bottom];
}

export function appendBowl(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  const outer = args[0],
    inner = args[1];
  if (!(outer instanceof FdBowlInfo)) return false;
  try {
    const mesh = context.createMesh();
    if (context.call.name === 'makeBowlSubstraction') {
      if (!(inner instanceof FdBowlInfo)) throw new Error('bowl subtraction requires two FdBowlInfo objects');
      const outside = loft(mesh, outer, false, false),
        inside = loft(mesh, inner, true, true);
      const up = normalized(toVec(outer.faces[0].upVector));
      // Nested bowl profiles form a shell. General solid intersections belong
      // to the native SDK boolean kernel and are deliberately reported below.
      cap(mesh, outside[0], inside[0], up);
      if (outer.faces[1].cover) cap(mesh, outside[1], undefined, up.mul(-1));
      scene.warnings.push(
        warningFor(
          context.call,
          'nested bowl shell preview; general solid subtraction requires the native FLM3 kernel',
        ),
      );
    } else loft(mesh, outer, false, true);
    if (outer.faces[0].corners.some((c) => c.trType === 1))
      scene.warnings.push(
        warningFor(
          context.call,
          'spline bowl transition uses an elliptical preview; SDK spline implementation is unavailable',
        ),
      );
    if (mesh.indices.length) scene.meshes.push(mesh);
    else throw new Error('bowl contains no non-degenerate surfaces');

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid bowl'));

    return true;
  }
}

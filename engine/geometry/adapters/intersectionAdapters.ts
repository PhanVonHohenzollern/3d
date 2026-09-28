import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import { isArray } from '@engine/runtime/RuntimeValue';
import { circularFaceCount, toVec, deg } from '@engine/geometry/helpers/geometryMath';
import { addTriangle, pushNonEmptyMesh, vertex } from '@engine/geometry/helpers/meshData';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewMesh } from '@engine/geometry/previewScene';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import { kMaxRingSegments } from '@engine/geometry/config/previewConstants';

interface Cylinder {
  origin: FdPoint3d;
  axis: FdVector3d;
  up: FdVector3d;
  side: FdVector3d;
  a: number;
  b: number;
  length: number;
}
interface Sample {
  p: FdPoint3d;
  normal: FdVector3d;
}

// A double[] parameter that must supply at least `count` finite numbers. A short argument used
// to turn into NaN positions, which drew nothing and warned about nothing.
function leadingReals(a: NamedArguments, name: string, count: number): number[] {
  const values = a.realArray(name);
  if (values.length < count || !values.slice(0, count).every(Number.isFinite))
    throw new Error(`${name} needs ${count} number${count === 1 ? '' : 's'}`);

  return values;
}

const defaultUp = (axis: FdVector3d): FdVector3d => {
  const ref = Math.abs(axis.z) < 0.9 ? new FdVector3d(0, 0, 1) : new FdVector3d(0, 1, 0);

  return ref.sub(axis.mul(axis.dotProduct(ref))).normal();
};

function cylinder(origin: FdPoint3d, axis: FdVector3d, up: FdVector3d, a: number, b: number, length: number): Cylinder {
  axis = axis.normal();
  up = up.sub(axis.mul(up.dotProduct(axis))).normal();
  if (axis.length() === 0 || up.length() === 0 || ![a, b, length].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('invalid cylinder dimensions or frame');

  return { origin, axis, up, side: axis.crossProduct(up).normal(), a: a / 2, b: b / 2, length };
}

function outside(p: FdPoint3d, tube: Cylinder): number {
  const v = p.sub(tube.origin),
    x = v.dotProduct(tube.axis);

  return Math.max(
    (v.dotProduct(tube.up) / tube.a) ** 2 + (v.dotProduct(tube.side) / tube.b) ** 2 - 1,
    -x / tube.length,
    (x - tube.length) / tube.length,
  );
}

function clippedTriangle(mesh: PreviewMesh, triangle: Sample[], cutter: Cylinder): void {
  const polygon: Sample[] = [];
  for (let i = 0; i < 3; ++i) {
    const a = triangle[i],
      b = triangle[(i + 1) % 3];
    const da = outside(a.p, cutter),
      db = outside(b.p, cutter);
    if (da >= 0) polygon.push(a);
    if (da >= 0 === db >= 0) continue;
    let lo = 0,
      hi = 1;
    for (let k = 0; k < 24; ++k) {
      const t = (lo + hi) / 2;
      if (outside(a.p.add(b.p.sub(a.p).mul(t)), cutter) >= 0 === da >= 0) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    polygon.push({
      p: a.p.add(b.p.sub(a.p).mul(t)),
      normal: a.normal
        .mul(1 - t)
        .add(b.normal.mul(t))
        .normal(),
    });
  }
  const start = mesh.vertices.length;
  for (const sample of polygon) mesh.vertices.push(vertex(toVec(sample.p), toVec(sample.normal)));
  for (let i = 1; i + 1 < polygon.length; ++i) addTriangle(mesh, start, start + i, start + i + 1);
}

function surface(
  context: MeshBuildContext,
  tube: Cylinder,
  cutter: Cylinder,
  complexity: number,
  half = false,
): PreviewMesh {
  const mesh = context.createMesh();
  const around = Math.min(kMaxRingSegments, circularFaceCount(complexity));
  const along = Math.min(kMaxRingSegments, Math.max(16, Math.ceil((tube.length / Math.min(cutter.a, cutter.b)) * 4)));

  const sample = (i: number, j: number): Sample => {
    const angle = (j / around) * Math.PI * (half ? 1 : 2);
    const radial = tube.up.mul(tube.a * Math.cos(angle)).add(tube.side.mul(tube.b * Math.sin(angle)));

    return {
      p: tube.origin.add(tube.axis.mul((tube.length * i) / along)).add(radial),
      normal: tube.up
        .mul(Math.cos(angle) / tube.a)
        .add(tube.side.mul(Math.sin(angle) / tube.b))
        .normal(),
    };
  };

  for (let i = 0; i < along; ++i)
    for (let j = 0; j < around; ++j) {
      const a = sample(i, j),
        b = sample(i, j + 1),
        c = sample(i + 1, j + 1),
        d = sample(i + 1, j);
      clippedTriangle(mesh, [a, b, c], cutter);
      clippedTriangle(mesh, [a, c, d], cutter);
    }

  return mesh;
}

function tubeIntersection(variant: 'tubeData' | 'tubeParams'): ApiMeshAdapter {
  return withAdapterErrors('invalid intersection arguments', (scene, context, args) => {
    const a = new NamedArguments(context, args);
    const start = a.point('start'),
      normal = a.fdVector('normal');
    // The overload without upVector derives it from the normal.
    const up = a.has('upVector') ? a.fdVector('upVector') : defaultUp(normal.normal());
    let main: Cylinder,
      branch: Cylinder,
      complexity: number,
      branchComplexity: number,
      half = false,
      onlyBranch = false;
    if (variant === 'tubeData') {
      const tube = leadingReals(a, 'tubeData', 2),
        inter = leadingReals(a, 'interTubeData', 4),
        angles = leadingReals(a, 'angles', 0);
      complexity = branchComplexity = a.real('n');
      half = a.flag('half');
      main = cylinder(start, normal, up, tube[0], tube[0], tube[1]);
      const direction = up.rotateBy(deg(angles[0] ?? 0), main.side).rotateBy(deg(angles[1] ?? 0), main.axis);
      const origin = start.add(main.axis.mul(inter[2])).add(main.side.mul(inter[3]));
      branch = cylinder(origin, direction, main.axis, inter[0], inter[0], inter[1]);
    } else {
      const tube = leadingReals(a, 'tubeParams', 3),
        position = leadingReals(a, 'interTubePosition', 2),
        inter = leadingReals(a, 'interTubeParams', 3),
        angles = leadingReals(a, 'angles', 1),
        n = leadingReals(a, 'complexities', 2);
      // A missing or malformed options array draws both tubes.
      onlyBranch = isArray(a.get('options')) && (a.flagArray('options')[2] ?? false);
      complexity = n[0];
      branchComplexity = n[1];
      main = cylinder(start, normal, up, tube[0], tube[1], tube[2]);
      const alpha = deg(angles[0]);
      const direction = main.axis
        .mul(-Math.cos(alpha))
        .add(main.up.mul(Math.sin(alpha)))
        .rotateBy(deg(angles[2] ?? 0), main.axis);
      const origin = start.add(main.axis.mul(position[0])).add(main.side.mul(position[1]));
      branch = cylinder(origin, direction, main.axis, inter[1], inter[2], inter[0]);
    }
    if (!Number.isFinite(complexity) || complexity < 1 || !Number.isFinite(branchComplexity) || branchComplexity < 1)
      throw new Error('complexity must be positive');
    if (!onlyBranch) {
      const mesh = surface(context, main, branch, complexity);
      mesh.apiName += '.main';
      pushNonEmptyMesh(scene, mesh);
    }
    const mesh = surface(context, branch, main, branchComplexity, half);
    mesh.apiName += '.branch';
    pushNonEmptyMesh(scene, mesh);
  });
}

export const intersectionAdapters: AdapterTable = {
  makeTubeToTubeIntersection: tubeIntersection('tubeParams'),
  makeTubeToTubeIntersection2: tubeIntersection('tubeData'),
};

import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import {
  isArray,
  isPoint,
  isVector,
  runtimeNumber,
  runtimeTruthy,
  type RuntimeValue,
} from '../../runtime/RuntimeValue';
import { warningFor } from '../helpers/apiCall';
import { circularFaceCount, toVec } from '../helpers/geometryMath';
import { addTriangle, pushNonEmptyMesh, vertex } from '../helpers/meshData';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene, PreviewMesh } from '../previewScene';

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

const numbers = (v: RuntimeValue): number[] => (isArray(v) ? v.elements.map(runtimeNumber) : []);

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
  const around = Math.min(256, circularFaceCount(complexity));
  const along = Math.min(256, Math.max(16, Math.ceil((tube.length / Math.min(cutter.a, cutter.b)) * 4)));

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

export function appendTubeIntersection(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const [start, normal] = args;
  if (!isPoint(start) || !isVector(normal)) return false;
  try {
    const hasUp = isVector(args[2]),
      index = hasUp ? 3 : 2;
    const up = hasUp ? (args[2] as FdVector3d) : defaultUp(normal.normal());
    let main: Cylinder,
      branch: Cylinder,
      complexity: number,
      branchComplexity: number,
      half = false,
      onlyBranch = false;
    if (context.call.name === 'makeTubeToTubeIntersection2') {
      const tube = numbers(args[index]),
        inter = numbers(args[index + 1]),
        angles = numbers(args[index + 2]);
      complexity = branchComplexity = runtimeNumber(args[index + 3]);
      half = runtimeTruthy(args[index + 4]);
      main = cylinder(start, normal, up, tube[0], tube[0], tube[1]);
      const direction = up
        .rotateBy(((angles[0] ?? 0) * Math.PI) / 180, main.side)
        .rotateBy(((angles[1] ?? 0) * Math.PI) / 180, main.axis);
      const origin = start.add(main.axis.mul(inter[2])).add(main.side.mul(inter[3]));
      branch = cylinder(origin, direction, main.axis, inter[0], inter[0], inter[1]);
    } else {
      const tube = numbers(args[index]),
        position = numbers(args[index + 1]),
        inter = numbers(args[index + 2]),
        angles = numbers(args[index + 3]),
        n = numbers(args[index + 4]);
      const options = args[index + 5];
      onlyBranch = isArray(options) && runtimeTruthy(options.elements[2]);
      complexity = n[0];
      branchComplexity = n[1];
      main = cylinder(start, normal, up, tube[0], tube[1], tube[2]);
      const alpha = (angles[0] * Math.PI) / 180;
      const direction = main.axis
        .mul(-Math.cos(alpha))
        .add(main.up.mul(Math.sin(alpha)))
        .rotateBy(((angles[2] ?? 0) * Math.PI) / 180, main.axis);
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
  } catch (error) {
    scene.warnings.push(
      warningFor(context.call, error instanceof Error ? error.message : 'invalid intersection arguments'),
    );
  }

  return true;
}

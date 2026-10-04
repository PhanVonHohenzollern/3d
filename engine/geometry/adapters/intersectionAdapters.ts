import { FdPoint3d, FdVector3d } from '@engine/runtime';
import { circularFaceCount, toVec, deg } from '@engine/geometry/helpers/geometryMath';
import { addTriangle, pushNonEmptyMesh, vertex } from '@engine/geometry/helpers/meshData';
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
interface Plane {
  origin: FdPoint3d;
  normal: FdVector3d;
}
interface TubeSurface {
  tube: Cylinder;
  ring: Sample[];
  planes: Plane[];
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

function tubeSurface(tube: Cylinder, complexity: number): TubeSurface {
  const count = Math.min(kMaxRingSegments, circularFaceCount(complexity));
  const ring = Array.from({ length: count }, (_, i): Sample => {
    const angle = (i / count) * Math.PI * 2;

    return {
      p: tube.origin.add(tube.up.mul(tube.a * Math.cos(angle))).add(tube.side.mul(tube.b * Math.sin(angle))),
      normal: tube.up
        .mul(Math.cos(angle) / tube.a)
        .add(tube.side.mul(Math.sin(angle) / tube.b))
        .normal(),
    };
  });
  const planes = ring.map((sample, i) => ({
    origin: sample.p,
    normal: ring[(i + 1) % count].p.sub(sample.p).crossProduct(tube.axis).normal(),
  }));
  planes.push(
    { origin: tube.origin, normal: tube.axis.neg() },
    { origin: tube.origin.add(tube.axis.mul(tube.length)), normal: tube.axis },
  );

  return { tube, ring, planes };
}

function splitPolygon(polygon: Sample[], plane: Plane, tolerance: number): [Sample[], Sample[]] {
  const distances = polygon.map(({ p }) => {
    const distance = p.sub(plane.origin).dotProduct(plane.normal);

    return Math.abs(distance) <= tolerance ? 0 : distance;
  });
  if (distances.every((d) => d <= 0)) return [polygon, []];
  if (distances.every((d) => d >= 0)) return [[], polygon];
  const inside: Sample[] = [],
    outside: Sample[] = [];
  for (let i = 0; i < polygon.length; ++i) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const da = distances[i],
      db = distances[(i + 1) % polygon.length];
    if (da <= 0) inside.push(a);
    if (da >= 0) outside.push(a);
    if (!(da < 0 && db > 0) && !(da > 0 && db < 0)) continue;
    const t = da / (da - db);
    const sample = {
      p: a.p.add(b.p.sub(a.p).mul(t)),
      normal: a.normal
        .mul(1 - t)
        .add(b.normal.mul(t))
        .normal(),
    };
    inside.push(sample);
    outside.push(sample);
  }

  return [inside, outside];
}

function appendPolygon(mesh: PreviewMesh, polygon: Sample[], tolerance: number): void {
  if (polygon.length < 3) return;
  const origin = polygon[0].p;
  const center = origin.add(
    polygon.reduce((sum, sample) => sum.add(sample.p.sub(origin)), new FdVector3d()).div(polygon.length),
  );
  const normal = polygon.reduce((sum, sample) => sum.add(sample.normal), new FdVector3d()).normal();
  const start = mesh.vertices.length;
  mesh.vertices.push(vertex(toVec(center), toVec(normal)));
  for (const sample of polygon) mesh.vertices.push(vertex(toVec(sample.p), toVec(sample.normal)));
  for (let i = 0; i < polygon.length; ++i) {
    const next = (i + 1) % polygon.length;
    const a = polygon[i].p.sub(center),
      b = polygon[next].p.sub(center);
    if (a.crossProduct(b).length() > tolerance * tolerance) addTriangle(mesh, start, start + i + 1, start + next + 1);
  }
}

function surface(
  source: TubeSurface,
  cutter: TubeSurface,
  tolerance: number,
  halves: readonly [boolean, boolean] = [true, true],
): Sample[][] {
  const polygons: Sample[][] = [];
  const [upper, lower] = halves;
  if (!upper && !lower) return polygons;
  const { tube, ring } = source;
  const radial = cutter.tube.axis.sub(tube.axis.mul(cutter.tube.axis.dotProduct(tube.axis))).normal();
  const halfPlane = { origin: tube.origin, normal: radial.mul(upper ? -1 : 1) };
  const end = tube.axis.mul(tube.length);
  for (let i = 0; i < ring.length; ++i) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    let polygon = [a, b, { p: b.p.add(end), normal: b.normal }, { p: a.p.add(end), normal: a.normal }];
    if (upper !== lower) [polygon] = splitPolygon(polygon, halfPlane, tolerance);
    if (polygon.length < 3) continue;
    let overlap = polygon;
    for (const plane of cutter.planes) {
      [overlap] = splitPolygon(overlap, plane, tolerance);
      if (overlap.length < 3) break;
    }
    if (overlap.length < 3) {
      polygons.push(polygon);
      continue;
    }
    for (const plane of cutter.planes) {
      const bordersOverlap = overlap.some(
        (sample, j) =>
          Math.abs(sample.p.sub(plane.origin).dotProduct(plane.normal)) <= tolerance &&
          Math.abs(overlap[(j + 1) % overlap.length].p.sub(plane.origin).dotProduct(plane.normal)) <= tolerance,
      );
      if (!bordersOverlap) continue;
      const [inside, outside] = splitPolygon(polygon, plane, tolerance);
      if (outside.length >= 3) polygons.push(outside);
      polygon = inside;
    }
  }

  return polygons;
}

function joinSurfaceEdges(groups: Sample[][][], tolerance: number): Sample[][][] {
  const cells = new Map<string, FdPoint3d[]>();
  const points: FdPoint3d[] = [];
  const toleranceSquared = tolerance * tolerance;
  const welded = groups.map((polygons) =>
    polygons.map((polygon) =>
      polygon.map((sample) => {
        const cell = [sample.p.x, sample.p.y, sample.p.z].map((v) => Math.floor(v / tolerance));
        let point: FdPoint3d | undefined;
        for (let x = -1; x <= 1 && !point; ++x)
          for (let y = -1; y <= 1 && !point; ++y)
            for (let z = -1; z <= 1 && !point; ++z)
              point = cells
                .get(`${cell[0] + x},${cell[1] + y},${cell[2] + z}`)
                ?.find((p) => p.sub(sample.p).lengthSqrd() <= toleranceSquared);
        if (!point) {
          point = sample.p;
          const key = cell.join(',');
          const bucket = cells.get(key) ?? [];
          bucket.push(point);
          cells.set(key, bucket);
          points.push(point);
        }

        return { p: point, normal: sample.normal };
      }),
    ),
  );

  const axes = (['x', 'y', 'z'] as const).map((axis) => ({
    axis,
    points: [...points].sort((a, b) => a[axis] - b[axis]),
  }));

  const lowerBound = (sorted: (typeof axes)[number], value: number) => {
    let lo = 0,
      hi = sorted.points.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted.points[mid][sorted.axis] < value) lo = mid + 1;
      else hi = mid;
    }

    return lo;
  };

  return welded.map((polygons) =>
    polygons.map((polygon) =>
      polygon.flatMap((a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        if (a.p === b.p) return [];
        const edge = b.p.sub(a.p),
          lengthSquared = edge.lengthSqrd();
        const ranges = axes.map((sorted) => ({
          sorted,
          lo: lowerBound(sorted, Math.min(a.p[sorted.axis], b.p[sorted.axis]) - tolerance),
          hi: lowerBound(sorted, Math.max(a.p[sorted.axis], b.p[sorted.axis]) + tolerance),
        }));
        const { sorted, lo, hi } = ranges.reduce((best, range) =>
          range.hi - range.lo < best.hi - best.lo ? range : best,
        );
        const splits: { p: FdPoint3d; t: number }[] = [];
        for (let j = lo; j < hi; ++j) {
          const p = sorted.points[j];
          if (p === a.p || p === b.p) continue;
          const t = p.sub(a.p).dotProduct(edge) / lengthSquared;
          if (t > 0 && t < 1 && p.sub(a.p.add(edge.mul(t))).lengthSqrd() <= toleranceSquared) splits.push({ p, t });
        }
        splits.sort((a, b) => a.t - b.t);

        return [
          a,
          ...splits.map(({ p, t }) => ({
            p,
            normal: a.normal
              .mul(1 - t)
              .add(b.normal.mul(t))
              .normal(),
          })),
        ];
      }),
    ),
  );
}

function tubeIntersection(variant: 'tubeData' | 'tubeParams'): ApiMeshAdapter {
  return withAdapterErrors('invalid intersection arguments', (scene, context, args) => {
    const a = new NamedArguments(context, args);
    const start = a.point('start'),
      normal = a.fdVector('normal');
    // The overload without upVector derives it from the normal.
    const up = a.has('upVector')
      ? a.fdVector('upVector')
      : variant === 'tubeParams'
        ? Math.abs(normal.normal().x) < 0.9
          ? new FdVector3d(1, 0, 0)
          : new FdVector3d(0, 1, 0)
        : defaultUp(normal.normal());
    let main: Cylinder,
      branch: Cylinder,
      complexity: number,
      branchComplexity: number,
      mainHalves: readonly [boolean, boolean];
    if (variant === 'tubeData') {
      const tube = leadingReals(a, 'tubeData', 2),
        inter = leadingReals(a, 'interTubeData', 4),
        angles = leadingReals(a, 'angles', 0);
      complexity = branchComplexity = a.real('n');
      mainHalves = [true, !a.flag('half')];
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
      const options = a.flagArray('options');
      if (options.length < 2) throw new Error('options needs 2 booleans');
      mainHalves = [options[0], options[1]];
      complexity = n[0];
      branchComplexity = n[1];
      main = cylinder(start, normal, up.rotateBy(deg(angles[2] ?? 0), normal), tube[0], tube[1], tube[2]);
      const alpha = deg(angles[0]),
        beta = deg(angles[1] ?? 90);
      const direction = main.axis
        .mul(-Math.cos(alpha))
        .add(main.up.mul(Math.sin(alpha) * Math.cos(beta)))
        .add(main.side.mul(Math.sin(alpha) * Math.sin(beta)));
      const origin = start.add(main.axis.mul(position[0])).add(main.up.mul(position[1]));
      branch = cylinder(origin, direction, main.axis, inter[1], inter[2], inter[0]);
    }
    if (!Number.isFinite(complexity) || complexity < 1 || !Number.isFinite(branchComplexity) || branchComplexity < 1)
      throw new Error('complexity must be positive');
    const mainSurface = tubeSurface(main, complexity),
      branchSurface = tubeSurface(branch, branchComplexity);
    const tolerance = 1e-10 * Math.max(main.a, main.b, main.length, branch.a, branch.b, branch.length);
    const [mainPolygons, branchPolygons] = joinSurfaceEdges(
      [surface(mainSurface, branchSurface, tolerance, mainHalves), surface(branchSurface, mainSurface, tolerance)],
      tolerance,
    );
    const mainMesh = context.createMesh();
    for (const polygon of mainPolygons) appendPolygon(mainMesh, polygon, tolerance);
    mainMesh.apiName += '.main';
    pushNonEmptyMesh(scene, mainMesh);
    const mesh = context.createMesh();
    for (const polygon of branchPolygons) appendPolygon(mesh, polygon, tolerance);
    mesh.apiName += '.branch';
    pushNonEmptyMesh(scene, mesh);
  });
}

export const intersectionAdapters: AdapterTable = {
  makeTubeToTubeIntersection: tubeIntersection('tubeParams'),
  makeTubeToTubeIntersection2: tubeIntersection('tubeData'),
};

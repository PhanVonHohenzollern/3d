import { cross, dot, DVec3, normalized } from '@engine/math/DVec3';
import { buildBoxMesh } from '@engine/geometry/builders/rectangularMeshes';
import { buildTaperedTubeMesh } from '@engine/geometry/builders/circularMeshes';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { rotateAroundAxis, toFdVector, toPoint } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

type Frame = ReturnType<NamedArguments['frame']>;

// What every Vasco builder shares: the arguments, the section frame and the two ways of adding
// a duct piece.
class VascoSketch {
  constructor(
    readonly scene: PreviewGeometryScene,
    readonly context: MeshBuildContext,
    readonly a: NamedArguments,
    readonly f: Frame,
  ) {}

  box(centers: DVec3[], normals: DVec3[], widths: number[], heights: number[], up = this.f.up, caps = false): void {
    if ([...widths, ...heights].some((x) => !Number.isFinite(x) || x <= 0))
      throw new Error('Vasco section dimensions must be positive');
    this.scene.meshes.push(
      buildBoxMesh(
        this.context,
        centers.length - 1,
        centers.map(toPoint),
        normals.map(toFdVector),
        centers.map(() => toFdVector(up)),
        widths,
        heights,
        [],
        caps,
        caps,
      ),
    );
  }

  tube(p: DVec3, n: DVec3, l: number, d0: number, d1 = d0): void {
    if (l > 0 && d0 > 0 && d1 > 0)
      this.scene.meshes.push(
        buildTaperedTubeMesh(this.context, toPoint(p), toPoint(p.add(n.mul(l))), d0, d1, this.a.count('n')),
      );
  }
}

function vasco(build: (v: VascoSketch) => void): ApiMeshAdapter {
  return withAdapterErrors('invalid Vasco geometry', (scene, context, args) => {
    const a = new NamedArguments(context, args);
    build(new VascoSketch(scene, context, a, a.frame()));
  });
}

function straight(v: VascoSketch): void {
  const { a, f } = v;
  const w = a.numbers('width'),
    h = a.numbers('height'),
    lens = a.numbers('length');
  if (w.length < 4 || h.length < 4 || lens.length < 4)
    throw new Error('Vasco straight requires four section dimensions');
  let distance = 0;
  const centers = [f.center];
  for (const l of lens) {
    if (l < 0) throw new Error('negative section length');
    distance += l;
    centers.push(f.center.add(f.normal.mul(distance)));
  }
  v.box(
    centers,
    centers.map(() => f.normal),
    [...w, w.at(-1)!],
    [...h, h.at(-1)!],
  );
}

function elbow(v: VascoSketch, kind: 'V' | 'H'): void {
  const { a, f } = v;
  const w = a.numbers('width'),
    h = a.numbers('height'),
    lens = a.numbers('length');
  const turn = kind === 'V' ? f.up : f.right,
    axis = normalized(cross(f.normal, turn));
  const angle = (a.num('angle', 90) * Math.PI) / 180,
    radius = Math.max(lens[1] ?? 0, Math.max(...w, ...h) / 2),
    count = a.count('nR');
  const centers = [],
    normals = [],
    widths = [],
    heights = [];
  for (let i = 0; i <= count; ++i) {
    const t = i / count,
      theta = angle * t;
    centers.push(
      f.center
        .add(f.normal.mul((lens[0] ?? 0) + radius * Math.sin(theta)))
        .add(turn.mul(radius * (1 - Math.cos(theta)))),
    );
    normals.push(rotateAroundAxis(f.normal, axis, theta));
    widths.push(w[0] + (w.at(-1)! - w[0]) * t);
    heights.push(h[0] + (h.at(-1)! - h[0]) * t);
  }
  // V elbows need a rotating up direction, provided through a separate mesh.
  const ups = normals.map((_, i) => (kind === 'V' ? rotateAroundAxis(f.up, axis, (angle * i) / count) : f.up));
  v.scene.meshes.push(
    buildBoxMesh(
      v.context,
      count,
      centers.map(toPoint),
      normals.map(toFdVector),
      ups.map(toFdVector),
      widths,
      heights,
      [],
      false,
      false,
    ),
  );
  if (lens[0] > 0) v.box([f.center, centers[0]], [f.normal, f.normal], [w[0], w[0]], [h[0], h[0]]);
  const tail = (lens[2] ?? 0) + (lens[3] ?? 0);
  if (tail > 0)
    v.box(
      [centers.at(-1)!, centers.at(-1)!.add(normals.at(-1)!.mul(tail))],
      [normals.at(-1)!, normals.at(-1)!],
      [w.at(-1)!, w.at(-1)!],
      [h.at(-1)!, h.at(-1)!],
      ups.at(-1)!,
    );
}

function transition(v: VascoSketch, diameters: 'elliptic' | 'round'): void {
  const { a, f } = v;
  const w = a.positive('width'),
    h = a.positive('height'),
    lens = a.numbers('length');
  const diam = diameters === 'elliptic' ? a.numbers('diameter') : [a.positive('diameter'), a.positive('diameter')];
  const distance = lens.reduce((sum, l) => sum + Math.max(0, l), 0),
    offset = a.num('offset');
  const end = f.center.add(f.normal.mul(distance)).add(f.up.mul(offset));
  const corners = [
    f.center.add(f.right.mul(w / 2)).add(f.up.mul(h / 2)),
    f.center.sub(f.right.mul(w / 2)).add(f.up.mul(h / 2)),
    f.center.sub(f.right.mul(w / 2)).sub(f.up.mul(h / 2)),
    f.center.add(f.right.mul(w / 2)).sub(f.up.mul(h / 2)),
  ];
  // Corresponding rectangle/ellipse perimeter samples provide a watertight loft.
  const count = 4 * a.count('n'),
    mesh = v.context.createMesh();
  const rings = [
    Array.from({ length: count }, (_, i) => {
      const side = Math.floor((4 * i) / count),
        t = (4 * i) / count - side;

      return corners[side].mul(1 - t).add(corners[(side + 1) % 4].mul(t));
    }),
    Array.from({ length: count }, (_, i) => {
      const t = Math.PI / 4 + (2 * Math.PI * i) / count;

      return end.add(f.right.mul((diam[0] / 2) * Math.cos(t))).add(f.up.mul((diam[1] / 2) * Math.sin(t)));
    }),
  ];
  // Wall normals: across the loft (around the ring) × along it, turned away from the axis.
  const axisPoints = [f.center, end];
  rings.forEach((ring, r) => {
    for (let i = 0; i < count; ++i) {
      const around = ring[(i + 1) % count].sub(ring[(i + count - 1) % count]),
        along = rings[1][i].sub(rings[0][i]);
      let normal = normalized(cross(around, along));
      if (dot(normal, ring[i].sub(axisPoints[r])) < 0) normal = normal.mul(-1);
      mesh.vertices.push(vertex(ring[i], normal));
    }
  });
  for (let i = 0; i < count; ++i) {
    const j = (i + 1) % count;
    mesh.indices.push(i, j, count + j, i, count + j, count + i);
  }
  v.scene.meshes.push(mesh);
}

function plenum1(v: VascoSketch): void {
  const { a, f } = v;
  const widths = a.numbers('width'),
    h = a.positive('height'),
    lens = a.numbers('length'),
    offset = a.numbers('offset');
  const l = Math.max(
    1,
    lens.reduce((sum, n) => sum + Math.max(0, n), 0),
  );
  v.box(
    [f.center, f.center.add(f.normal.mul(l))],
    [f.normal, f.normal],
    [widths[0], widths.at(-1)!],
    [h, h],
    f.up,
    true,
  );
  const cw = a.numbers('connWidth'),
    ch = a.numbers('connHeight');
  for (let i = 0; i < 2; ++i) {
    const n = f.right.mul(i === 0 ? 1 : -1),
      p = f.center
        .add(f.normal.mul((l * (i + 1)) / 3))
        .add(n.mul(widths[0] / 2))
        .add(f.up.mul(offset[i] ?? 0));
    const length = a.numbers(i === 0 ? 'connLen1' : 'connLen2').reduce((sum, v) => sum + v, 0);
    v.box([p, p.add(n.mul(length))], [n, n], [cw[i], cw[i]], [ch[i], ch[i]]);
  }
  a.numbers('diameter').forEach((d, i) =>
    v.tube(f.center.add(f.normal.mul((l * (i + 1)) / 3)).add(f.up.mul(h / 2)), f.up, lens[i] ?? h / 4, d),
  );
}

function boxPlenum(v: VascoSketch, connOffsets: 'given' | 'default'): void {
  const { a, f } = v;
  const size = a.positive('boxSize'),
    heights = a.numbers('height'),
    cw = a.numbers('connWidth'),
    ch = a.numbers('connHeight'),
    cl = a.numbers('connLength'),
    diam = a.numbers('connDiameter');
  const height = heights[0],
    top = f.center.add(f.up.mul(height));
  v.box([f.center, top], [f.up, f.up], [size, size], [size, size], f.normal, true);
  [f.normal, f.right, f.normal.mul(-1)].forEach((n, i) => {
    const p = f.center.add(f.up.mul(height / 2)).add(n.mul(size / 2));
    v.box([p, p.add(n.mul(cl[i]))], [n, n], [cw[i], cw[i]], [ch[i], ch[i]]);
  });
  const offsets = connOffsets === 'given' ? a.numbers('connOffsets') : [-size / 4, size / 4];
  diam.forEach((d, i) => v.tube(top.add(f.right.mul(offsets[i] ?? 0)), f.up, heights[1] ?? height / 3, d));
}

export const vascoAdapters: AdapterTable = {
  makeVascoStraight: vasco(straight),
  makeVascoElbowV: vasco((v) => elbow(v, 'V')),
  makeVascoElbowH: vasco((v) => elbow(v, 'H')),
  makeVascoTransition: vasco((v) => transition(v, 'elliptic')),
  makeVascoElbowTransition: vasco((v) => transition(v, 'round')),
  makeVascoVascoPlenum1: vasco(plenum1),
  makeVascoVascoPlenum2: vasco((v) => boxPlenum(v, 'default')),
  makeVascoVascoPlenum3: vasco((v) => boxPlenum(v, 'given')),
};

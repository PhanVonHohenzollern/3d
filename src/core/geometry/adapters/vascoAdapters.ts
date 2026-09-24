import { cross, DVec3, normalized } from '../../../utils/DVec3';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildBoxMesh } from '../builders/rectangularMeshes';
import { buildTaperedTubeMesh } from '../builders/circularMeshes';
import { warningFor } from '../helpers/apiCall';
import { rotateAroundAxis, toFdVector, toPoint } from '../helpers/geometryMath';
import { NamedArguments } from '../helpers/NamedArguments';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

export const vascoApiNames = [
  'makeVascoStraight',
  'makeVascoElbowV',
  'makeVascoElbowH',
  'makeVascoTransition',
  'makeVascoElbowTransition',
  'makeVascoVascoPlenum1',
  'makeVascoVascoPlenum2',
  'makeVascoVascoPlenum3',
];

export function appendVasco(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  try {
    const a = new NamedArguments(context, args),
      f = a.frame(),
      name = context.call.name;

    const box = (centers: DVec3[], normals: DVec3[], widths: number[], heights: number[], up = f.up, caps = false) => {
      if ([...widths, ...heights].some((x) => !Number.isFinite(x) || x <= 0))
        throw new Error('Vasco section dimensions must be positive');
      scene.meshes.push(
        buildBoxMesh(
          context,
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
    };

    const tube = (p: DVec3, n: DVec3, l: number, d0: number, d1 = d0) => {
      if (l > 0 && d0 > 0 && d1 > 0)
        scene.meshes.push(buildTaperedTubeMesh(context, toPoint(p), toPoint(p.add(n.mul(l))), d0, d1, a.count('n')));
    };

    if (name === 'makeVascoStraight') {
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
      box(
        centers,
        centers.map(() => f.normal),
        [...w, w.at(-1)!],
        [...h, h.at(-1)!],
      );

      return true;
    }
    if (name === 'makeVascoElbowV' || name === 'makeVascoElbowH') {
      const w = a.numbers('width'),
        h = a.numbers('height'),
        lens = a.numbers('length');
      const turn = name.endsWith('V') ? f.up : f.right,
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
      const ups = normals.map((_, i) =>
        name.endsWith('V') ? rotateAroundAxis(f.up, axis, (angle * i) / count) : f.up,
      );
      scene.meshes.push(
        buildBoxMesh(
          context,
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
      if (lens[0] > 0) box([f.center, centers[0]], [f.normal, f.normal], [w[0], w[0]], [h[0], h[0]]);
      const tail = (lens[2] ?? 0) + (lens[3] ?? 0);
      if (tail > 0)
        box(
          [centers.at(-1)!, centers.at(-1)!.add(normals.at(-1)!.mul(tail))],
          [normals.at(-1)!, normals.at(-1)!],
          [w.at(-1)!, w.at(-1)!],
          [h.at(-1)!, h.at(-1)!],
          ups.at(-1)!,
        );

      return true;
    }
    if (name === 'makeVascoTransition' || name === 'makeVascoElbowTransition') {
      const w = a.positive('width'),
        h = a.positive('height'),
        lens = a.numbers('length');
      const diam =
        name === 'makeVascoTransition' ? a.numbers('diameter') : [a.positive('diameter'), a.positive('diameter')];
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
        mesh = context.createMesh();
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
      for (const ring of rings)
        for (const p of ring)
          mesh.vertices.push({ x: p.x, y: p.y, z: p.z, nx: f.normal.x, ny: f.normal.y, nz: f.normal.z });
      for (let i = 0; i < count; ++i) {
        const j = (i + 1) % count;
        mesh.indices.push(i, j, count + j, i, count + j, count + i);
      }
      scene.meshes.push(mesh);

      return true;
    }
    if (name === 'makeVascoVascoPlenum1') {
      const widths = a.numbers('width'),
        h = a.positive('height'),
        lens = a.numbers('length'),
        offset = a.numbers('offset');
      const l = Math.max(
        1,
        lens.reduce((sum, n) => sum + Math.max(0, n), 0),
      );
      box(
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
        box([p, p.add(n.mul(length))], [n, n], [cw[i], cw[i]], [ch[i], ch[i]]);
      }
      a.numbers('diameter').forEach((d, i) =>
        tube(f.center.add(f.normal.mul((l * (i + 1)) / 3)).add(f.up.mul(h / 2)), f.up, lens[i] ?? h / 4, d),
      );

      return true;
    }
    const size = a.positive('boxSize'),
      heights = a.numbers('height'),
      cw = a.numbers('connWidth'),
      ch = a.numbers('connHeight'),
      cl = a.numbers('connLength'),
      diam = a.numbers('connDiameter');
    const height = heights[0],
      top = f.center.add(f.up.mul(height));
    box([f.center, top], [f.up, f.up], [size, size], [size, size], f.normal, true);
    [f.normal, f.right, f.normal.mul(-1)].forEach((n, i) => {
      const p = f.center.add(f.up.mul(height / 2)).add(n.mul(size / 2));
      box([p, p.add(n.mul(cl[i]))], [n, n], [cw[i], cw[i]], [ch[i], ch[i]]);
    });
    const offsets = name.endsWith('3') ? a.numbers('connOffsets') : [-size / 4, size / 4];
    diam.forEach((d, i) => tube(top.add(f.right.mul(offsets[i] ?? 0)), f.up, heights[1] ?? height / 3, d));

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid Vasco geometry'));

    return true;
  }
}

import { cross, DVec3, normalized } from '../../../utils/DVec3';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildPolygonFaceMesh } from '../builders/rectangularMeshes';
import { warningFor } from '../helpers/apiCall';
import { rotateAroundAxis, toPoint } from '../helpers/geometryMath';
import { NamedArguments } from '../helpers/NamedArguments';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendStroke } from './symbolAdapters';

export const grillApiNames = [
  'makeRoseOfWindsLamels',
  'makeRectSimpleGrill',
  'makeCircSimpleGrill',
  'makeDonutSection2',
  'makeKRS',
  'makeCurvedLamel',
  ...Array.from({ length: 7 }, (_, i) => `makeRectGrillType${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `makeGrillType${i + 1}`),
];

export function appendGrill(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  try {
    const a = new NamedArguments(context, args),
      name = context.call.name;

    const face = (p: DVec3[]) => scene.meshes.push(buildPolygonFaceMesh(context, p.map(toPoint)));

    const stroke = (p: DVec3[], closed = false) => appendStroke(scene, context, p, closed);

    if (name === 'makeRoseOfWindsLamels') {
      const points = Array.from({ length: 6 }, (_, i) => a.vector(`p${i + 1}`)),
        count = a.count('n');
      for (let i = 0; i < count; ++i) {
        const t = i / count,
          s = (i + 1) / count;
        face([
          points[0].add(points[1].sub(points[0]).mul(t)),
          points[2].add(points[3].sub(points[2]).mul(t)),
          points[4].add(points[5].sub(points[4]).mul(s)),
        ]);
      }

      return true;
    }
    const f = a.frame();

    const at = (x: number, y: number, z = 0) => f.center.add(f.right.mul(x)).add(f.up.mul(y)).add(f.normal.mul(z));

    const ring = (radius: number, z = 0, begin = 0, end = 360, count = 64) =>
      Array.from({ length: count + 1 }, (_, i) => {
        const t = ((begin + ((end - begin) * i) / count) * Math.PI) / 180;

        return at(radius * Math.cos(t), radius * Math.sin(t), z);
      });

    if (name === 'makeDonutSection2' || name === 'makeKRS') {
      const outer = a.positive('dext') / 2,
        inner = a.positive(name === 'makeKRS' ? 'dint' : 'din') / 2;
      const h = a.num('h'),
        count = 4 * a.count('cpx'),
        begin = a.num('startAngle', 0),
        end = a.num('endAngle', 360);
      const bands = name === 'makeKRS' ? a.count('Ln') : 1;
      for (let k = 0; k < bands; ++k) {
        const r0 = inner + ((outer - inner) * k) / bands,
          r1 = name === 'makeKRS' ? Math.min(outer, r0 + a.positive('llen')) : outer;
        const p = ring(r0, 0, begin, end, count),
          q = ring(r1, h, begin, end, count);
        for (let i = 0; i < count; ++i) face([p[i], p[i + 1], q[i + 1], q[i]]);
      }

      return true;
    }
    if (name === 'makeCurvedLamel') {
      const radius = a.positive('R'),
        w = a.positive('L'),
        angle = (a.num('alfa') * Math.PI) / 180,
        count = 4 * a.count('cpx'),
        offset = a.num('rh');
      for (let i = 0; i < count; ++i) {
        const t = (i / count) * angle,
          s = ((i + 1) / count) * angle;
        face([
          at(-w / 2, radius * Math.sin(t), offset + radius * (1 - Math.cos(t))),
          at(w / 2, radius * Math.sin(t), offset + radius * (1 - Math.cos(t))),
          at(w / 2, radius * Math.sin(s), offset + radius * (1 - Math.cos(s))),
          at(-w / 2, radius * Math.sin(s), offset + radius * (1 - Math.cos(s))),
        ]);
      }

      return true;
    }
    if (name.startsWith('makeRect') || ['makeGrillType6', 'makeGrillType7'].includes(name)) {
      const w = a.positive('L'),
        h = a.positive('H'),
        count = name === 'makeRectSimpleGrill' ? 8 : a.count(name.startsWith('makeRectGrill') ? 'ln' : 'n');
      const angle = (a.num('alfa', 0) * Math.PI) / 180,
        depth = a.num('a', a.num('rt', a.num('thickness', (h / count) * 0.2)));
      const type = Number(name.at(-1)) || 1;
      const tilt = rotateAroundAxis(f.up, f.right, angle),
        band = Math.min((h / count) * 0.8, Math.max(0.7, Math.abs(depth)));
      for (let i = 0; i < count; ++i) {
        const y = -h / 2 + ((i + 0.5) * h) / count;
        const center = at(0, y);
        const dir = type % 2 === 0 ? tilt : rotateAroundAxis(tilt, f.normal, 0);
        face([
          center.sub(f.right.mul(w / 2)).sub(dir.mul(band / 2)),
          center.add(f.right.mul(w / 2)).sub(dir.mul(band / 2)),
          center.add(f.right.mul(w / 2)).add(dir.mul(band / 2)),
          center.sub(f.right.mul(w / 2)).add(dir.mul(band / 2)),
        ]);
      }
      if (type === 3 || type === 4 || type === 7)
        for (let i = 1; i < count; ++i)
          stroke([at(-w / 2 + (i * w) / count, -h / 2), at(-w / 2 + (i * w) / count, h / 2)]);
      if (name === 'makeRectSimpleGrill' || a.bool('closeLast'))
        stroke([at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)], true);

      return true;
    }
    const radius = name === 'makeCircSimpleGrill' ? a.positive('D') / 2 : a.positive('D2') / 2;
    const inner = name === 'makeCircSimpleGrill' ? 0 : Math.max(0, a.num('D1', 0) / 2);
    const backRadius = name === 'makeCircSimpleGrill' ? radius : a.positive('D3') / 2;
    const count = a.count('n', 8, 128),
      rings = a.count('m', 3, 64),
      angle = (a.num('alfa', 0) * Math.PI) / 180;
    stroke(ring(radius));
    if (inner > 0 && a.bool('innerCircle', true)) stroke(ring(inner));
    if (name === 'makeCircSimpleGrill') {
      for (let i = 1; i < count; ++i) {
        const y = -radius + (2 * radius * i) / count,
          x = Math.sqrt(radius * radius - y * y);
        stroke([at(-x, y), at(x, y)]);
      }

      return true;
    }
    const height = a.num('bladeHeight', a.num('flangeHeight', a.num('thickness', a.num('d', 1))));
    for (let i = 0; i < count; ++i) {
      const t = (2 * Math.PI * i) / count;
      const radial = f.right.mul(Math.cos(t)).add(f.up.mul(Math.sin(t)));
      const tangent = normalized(cross(f.normal, radial));
      const tip = f.center.add(radial.mul(backRadius));
      const base = f.center.add(radial.mul(inner));
      const delta = rotateAroundAxis(tangent, radial, angle).mul(Math.max(0.5, Math.abs(height)) / 2);
      face([base.sub(delta), tip.sub(delta), tip.add(delta), base.add(delta)]);
    }
    for (let i = 1; i <= rings; ++i) stroke(ring(inner + ((radius - inner) * i) / rings, (a.num('h', 0) * i) / rings));

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid grill'));

    return true;
  }
}

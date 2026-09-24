import { DVec3 } from '../../../utils/DVec3';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { warningFor } from '../helpers/apiCall';
import { NamedArguments } from '../helpers/NamedArguments';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendStroke } from './symbolAdapters';

export const patternApiNames = ['makeKFSymbolCurved', 'makeKFSymbolFlat', 'makeRectHoles', 'makeRoundedRectHoles'];

export function appendPattern(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  try {
    const a = new NamedArguments(context, args),
      f = a.frame(),
      name = context.call.name;

    const at = (x: number, y: number, z = 0) => f.center.add(f.right.mul(x)).add(f.up.mul(y)).add(f.normal.mul(z));

    const stroke = (p: DVec3[], closed = false) => appendStroke(scene, context, p, closed);

    if (name === 'makeKFSymbolFlat') {
      const w = a.positive('width'),
        h = a.positive('height'),
        sw = a.positive('swidth'),
        sh = a.positive('hs');
      const dx = sw + a.positive('hwidth'),
        dy = sh + a.positive('hh'),
        rows = Math.min(128, Math.floor(h / dy)),
        cols = Math.min(128, Math.floor(w / dx));
      for (let r = 0; r <= rows; ++r)
        for (let c = 0; c < cols; ++c) {
          const x = -w / 2 + c * dx + a.num('startOff') + (r % 2) * a.num('off'),
            y = -h / 2 + r * dy;
          if (x + sw > w / 2 || y + sh > h / 2) continue;
          stroke([at(x, y + sh), at(x + sw / 2, y), at(x + sw, y + sh)]);
        }

      return true;
    }
    if (name === 'makeKFSymbolCurved') {
      const radius = a.positive('D') / 2,
        h = a.positive('height'),
        sh = a.positive('hs'),
        spacing = sh + a.positive('hh');
      const first = a.num('startAngle'),
        last = a.num('endAngle'),
        pitch = a.positive('beta'),
        spread = a.num('alfa'),
        shift = a.num('gamma');
      const rows = Math.min(128, Math.floor(h / spacing)),
        cols = Math.min(256, Math.ceil(Math.abs(last - first) / pitch));

      const polar = (angle: number, z: number) =>
        at(radius * Math.cos((angle * Math.PI) / 180), radius * Math.sin((angle * Math.PI) / 180), z);

      for (let r = 0; r <= rows; ++r)
        for (let c = 0; c < cols; ++c) {
          const t = first + c * pitch + (r % 2) * shift,
            z = r * spacing;
          if (t + spread > last || z + sh > h) continue;
          stroke([polar(t, z + sh), polar(t + spread / 2, z), polar(t + spread, z + sh)]);
        }

      return true;
    }
    const inner = a.positive('Din') / 2,
      outer = name === 'makeRectHoles' ? a.positive('Dout') / 2 : inner + a.positive('Len');
    const count = a.count('numberHoles', 4),
      half = a.positive('holeWidth') / 2,
      ain = (a.num('alfaIn') * Math.PI) / 180,
      aout = (a.num('alfaOut', a.num('alfaIn')) * Math.PI) / 180;
    for (let i = 0; i < count; ++i) {
      const t = (i * Math.PI * 2) / count,
        radial = f.right.mul(Math.cos(t)).add(f.up.mul(Math.sin(t))),
        tangent = f.right.mul(-Math.sin(t)).add(f.up.mul(Math.cos(t)));
      const p = f.center.add(radial.mul(inner)),
        q = f.center.add(radial.mul(outer));
      if (name === 'makeRoundedRectHoles') {
        const points = Array.from({ length: 25 }, (_, j) => {
          const theta = (j * Math.PI) / 24;

          return q.add(tangent.mul(half * Math.cos(theta))).add(radial.mul(half * Math.sin(theta)));
        });
        points.push(
          ...Array.from({ length: 25 }, (_, j) => {
            const theta = Math.PI + (j * Math.PI) / 24;

            return p.add(tangent.mul(half * Math.cos(theta))).add(radial.mul(half * Math.sin(theta)));
          }),
        );
        stroke(points, true);
      } else
        stroke(
          [
            p.sub(tangent.mul(half)).add(radial.mul(half * Math.tan(ain))),
            q.sub(tangent.mul(half)).add(radial.mul(half * Math.tan(aout))),
            q.add(tangent.mul(half)).sub(radial.mul(half * Math.tan(aout))),
            p.add(tangent.mul(half)).sub(radial.mul(half * Math.tan(ain))),
          ],
          true,
        );
    }

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid symbol pattern'));

    return true;
  }
}

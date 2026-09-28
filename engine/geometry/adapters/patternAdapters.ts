import { DVec3 } from '@engine/math/DVec3';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import { appendStroke } from '@engine/geometry/adapters/symbolAdapters';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';

type Frame = ReturnType<NamedArguments['frame']>;

// What every pattern shares: the arguments, the placement frame and how a stroke is drawn in it.
class PatternSketch {
  constructor(
    readonly scene: PreviewGeometryScene,
    readonly context: MeshBuildContext,
    readonly a: NamedArguments,
    readonly f: Frame,
  ) {}

  at(x: number, y: number, z = 0): DVec3 {
    const { f } = this;

    return f.center.add(f.right.mul(x)).add(f.up.mul(y)).add(f.normal.mul(z));
  }

  stroke(p: DVec3[], closed = false): void {
    appendStroke(this.scene, this.context, p, closed);
  }
}

function pattern(build: (s: PatternSketch) => void): ApiMeshAdapter {
  return withAdapterErrors('invalid symbol pattern', (scene, context, args) => {
    const a = new NamedArguments(context, args);
    build(new PatternSketch(scene, context, a, a.frame()));
  });
}

function kfFlat(s: PatternSketch): void {
  const { a } = s;
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
      s.stroke([s.at(x, y + sh), s.at(x + sw / 2, y), s.at(x + sw, y + sh)]);
    }
}

function kfCurved(s: PatternSketch): void {
  const { a } = s;
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
    s.at(radius * Math.cos((angle * Math.PI) / 180), radius * Math.sin((angle * Math.PI) / 180), z);

  for (let r = 0; r <= rows; ++r)
    for (let c = 0; c < cols; ++c) {
      const t = first + c * pitch + (r % 2) * shift,
        z = r * spacing;
      if (t + spread > last || z + sh > h) continue;
      s.stroke([polar(t, z + sh), polar(t + spread / 2, z), polar(t + spread, z + sh)]);
    }
}

// Rect holes run from Din to Dout with slanted ends; rounded holes are Len long with half-round ends.
function radialHoles(s: PatternSketch, shape: 'rect' | 'rounded'): void {
  const { a, f } = s;
  const inner = a.positive('Din') / 2,
    outer = shape === 'rect' ? a.positive('Dout') / 2 : inner + a.positive('Len');
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
    if (shape === 'rounded') {
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
      s.stroke(points, true);
    } else
      s.stroke(
        [
          p.sub(tangent.mul(half)).add(radial.mul(half * Math.tan(ain))),
          q.sub(tangent.mul(half)).add(radial.mul(half * Math.tan(aout))),
          q.add(tangent.mul(half)).sub(radial.mul(half * Math.tan(aout))),
          p.add(tangent.mul(half)).sub(radial.mul(half * Math.tan(ain))),
        ],
        true,
      );
  }
}

export const patternAdapters: AdapterTable = {
  makeKFSymbolCurved: pattern(kfCurved),
  makeKFSymbolFlat: pattern(kfFlat),
  makeRectHoles: pattern((s) => radialHoles(s, 'rect')),
  makeRoundedRectHoles: pattern((s) => radialHoles(s, 'rounded')),
};

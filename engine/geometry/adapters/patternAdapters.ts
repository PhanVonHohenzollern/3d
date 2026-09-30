import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { NamedArguments, type Frame } from '@engine/geometry/helpers/NamedArguments';
import { FrameSketch } from '@engine/geometry/helpers/sketch';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { deg } from '@engine/geometry/helpers/geometryMath';
import { kMaxRingSegments } from '@engine/geometry/config/previewConstants';

// What every pattern shares: the arguments, the placement frame and how a stroke is drawn in it.
class PatternSketch extends FrameSketch {
  constructor(
    scene: PreviewGeometryScene,
    context: MeshBuildContext,
    readonly a: NamedArguments,
    f: Frame,
  ) {
    super(scene, context, f);
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
    start = a.num('startOff'),
    offset = a.num('off');
  for (let r = 0; r <= rows; ++r) {
    const rowStart = start + (r % 2) * offset,
      cols = Math.min(128, Math.floor((w - rowStart - sw) / dx) + 1);
    for (let c = 0; c < cols; ++c) {
      const x = -w / 2 + c * dx + rowStart,
        y = -h / 2 + r * dy;
      if (x + sw > w / 2 || y + sh > h / 2) continue;
      s.stroke([s.at(x, y + sh), s.at(x + sw / 2, y), s.at(x + sw, y + sh)]);
    }
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
    cols = Math.min(kMaxRingSegments, Math.ceil(Math.abs(last - first) / pitch));

  const polar = (angle: number, z: number) => s.at(radius * Math.cos(deg(angle)), radius * Math.sin(deg(angle)), z);

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
    ain = deg(a.num('alfaIn')),
    aout = deg(a.num('alfaOut', a.num('alfaIn')));
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

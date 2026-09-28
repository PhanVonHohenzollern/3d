import { cross, normalized } from '@engine/math/DVec3';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { rotateAroundAxis, deg } from '@engine/geometry/helpers/geometryMath';
import { NamedArguments, type Frame } from '@engine/geometry/helpers/NamedArguments';
import { FrameSketch, MeshSketch } from '@engine/geometry/helpers/sketch';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';

type RectGrillOptions = {
  // A fixed lamel count, or the argument that holds it.
  count: number | 'n' | 'ln';
  type: number;
  outline: 'always' | 'closeLast';
};

const invalidGrill = 'invalid grill';

// What every framed grill builder shares: the arguments and the grill frame to draw in.
class GrillSketch extends FrameSketch {
  constructor(
    scene: PreviewGeometryScene,
    context: MeshBuildContext,
    readonly a: NamedArguments,
    f: Frame,
  ) {
    super(scene, context, f);
  }
}

function grill(build: (g: GrillSketch) => void): ApiMeshAdapter {
  return withAdapterErrors(invalidGrill, (scene, context, args) => {
    const a = new NamedArguments(context, args);
    build(new GrillSketch(scene, context, a, a.frame()));
  });
}

// The only grill placed by its six corner points, so it never reads a frame.
const roseOfWindsLamels = withAdapterErrors(invalidGrill, (scene, context, args) => {
  const a = new NamedArguments(context, args);
  const points = Array.from({ length: 6 }, (_, i) => a.vector(`p${i + 1}`)),
    count = a.count('n');
  for (let i = 0; i < count; ++i) {
    const t = i / count,
      s = (i + 1) / count;
    new MeshSketch(scene, context).fill([
      points[0].add(points[1].sub(points[0]).mul(t)),
      points[2].add(points[3].sub(points[2]).mul(t)),
      points[4].add(points[5].sub(points[4]).mul(s)),
    ]);
  }
});

function donut(g: GrillSketch, kind: 'section' | 'krs'): void {
  const { a } = g;
  const outer = a.positive('dext') / 2,
    inner = a.positive(kind === 'krs' ? 'dint' : 'din') / 2;
  const h = a.num('h'),
    count = 4 * a.count('cpx'),
    begin = a.num('startAngle', 0),
    end = a.num('endAngle', 360);
  const bands = kind === 'krs' ? a.count('Ln') : 1;
  for (let k = 0; k < bands; ++k) {
    const r0 = inner + ((outer - inner) * k) / bands,
      r1 = kind === 'krs' ? Math.min(outer, r0 + a.positive('llen')) : outer;
    const p = g.arc(r0, 0, begin, end, count),
      q = g.arc(r1, h, begin, end, count);
    for (let i = 0; i < count; ++i) g.fill([p[i], p[i + 1], q[i + 1], q[i]]);
  }
}

function curvedLamel(g: GrillSketch): void {
  const { a } = g;
  const radius = a.positive('R'),
    w = a.positive('L'),
    angle = deg(a.num('alfa')),
    count = 4 * a.count('cpx'),
    offset = a.num('rh');
  for (let i = 0; i < count; ++i) {
    const t = (i / count) * angle,
      s = ((i + 1) / count) * angle;
    g.fill([
      g.at(-w / 2, radius * Math.sin(t), offset + radius * (1 - Math.cos(t))),
      g.at(w / 2, radius * Math.sin(t), offset + radius * (1 - Math.cos(t))),
      g.at(w / 2, radius * Math.sin(s), offset + radius * (1 - Math.cos(s))),
      g.at(-w / 2, radius * Math.sin(s), offset + radius * (1 - Math.cos(s))),
    ]);
  }
}

function rectGrill(g: GrillSketch, { count: lamels, type, outline }: RectGrillOptions): void {
  const { a, f } = g;
  const w = a.positive('L'),
    h = a.positive('H'),
    count = typeof lamels === 'number' ? lamels : a.count(lamels);
  const angle = deg(a.num('alfa', 0)),
    depth = a.num('a', a.num('rt', a.num('thickness', (h / count) * 0.2)));
  const tilt = rotateAroundAxis(f.up, f.right, angle),
    band = Math.min((h / count) * 0.8, Math.max(0.7, Math.abs(depth)));
  for (let i = 0; i < count; ++i) {
    const y = -h / 2 + ((i + 0.5) * h) / count;
    const center = g.at(0, y);
    const dir = type % 2 === 0 ? tilt : rotateAroundAxis(tilt, f.normal, 0);
    g.fill([
      center.sub(f.right.mul(w / 2)).sub(dir.mul(band / 2)),
      center.add(f.right.mul(w / 2)).sub(dir.mul(band / 2)),
      center.add(f.right.mul(w / 2)).add(dir.mul(band / 2)),
      center.sub(f.right.mul(w / 2)).add(dir.mul(band / 2)),
    ]);
  }
  if (type === 3 || type === 4 || type === 7)
    for (let i = 1; i < count; ++i)
      g.stroke([g.at(-w / 2 + (i * w) / count, -h / 2), g.at(-w / 2 + (i * w) / count, h / 2)]);
  if (outline === 'always' || a.bool('closeLast'))
    g.stroke([g.at(-w / 2, -h / 2), g.at(w / 2, -h / 2), g.at(w / 2, h / 2), g.at(-w / 2, h / 2)], true);
}

// Reads the arguments every circular grill has, even when the grill leaves some unused, and
// draws the rim.
function circularRim(g: GrillSketch, radius: number, inner: number): { count: number; rings: number; angle: number } {
  const { a } = g;
  const count = a.count('n', 8, 128),
    rings = a.count('m', 3, 64),
    angle = deg(a.num('alfa', 0));
  g.stroke(g.arc(radius));
  if (inner > 0 && a.bool('innerCircle', true)) g.stroke(g.arc(inner));

  return { count, rings, angle };
}

function circSimpleGrill(g: GrillSketch): void {
  const radius = g.a.positive('D') / 2;
  const { count } = circularRim(g, radius, 0);
  for (let i = 1; i < count; ++i) {
    const y = -radius + (2 * radius * i) / count,
      x = Math.sqrt(radius * radius - y * y);
    g.stroke([g.at(-x, y), g.at(x, y)]);
  }
}

function bladedGrill(g: GrillSketch): void {
  const { a, f } = g;
  const radius = a.positive('D2') / 2;
  const inner = Math.max(0, a.num('D1', 0) / 2);
  const backRadius = a.positive('D3') / 2;
  const { count, rings, angle } = circularRim(g, radius, inner);
  const height = a.num('bladeHeight', a.num('flangeHeight', a.num('thickness', a.num('d', 1))));
  for (let i = 0; i < count; ++i) {
    const t = (2 * Math.PI * i) / count;
    const radial = f.right.mul(Math.cos(t)).add(f.up.mul(Math.sin(t)));
    const tangent = normalized(cross(f.normal, radial));
    const tip = f.center.add(radial.mul(backRadius));
    const base = f.center.add(radial.mul(inner));
    const delta = rotateAroundAxis(tangent, radial, angle).mul(Math.max(0.5, Math.abs(height)) / 2);
    g.fill([base.sub(delta), tip.sub(delta), tip.add(delta), base.add(delta)]);
  }
  for (let i = 1; i <= rings; ++i) g.stroke(g.arc(inner + ((radius - inner) * i) / rings, (a.num('h', 0) * i) / rings));
}

export const grillAdapters: AdapterTable = {
  makeRoseOfWindsLamels: roseOfWindsLamels,
  makeRectSimpleGrill: grill((g) => rectGrill(g, { count: 8, type: 1, outline: 'always' })),
  makeCircSimpleGrill: grill(circSimpleGrill),
  makeDonutSection2: grill((g) => donut(g, 'section')),
  makeKRS: grill((g) => donut(g, 'krs')),
  makeCurvedLamel: grill(curvedLamel),
  makeRectGrillType1: grill((g) => rectGrill(g, { count: 'ln', type: 1, outline: 'closeLast' })),
  makeRectGrillType2: grill((g) => rectGrill(g, { count: 'ln', type: 2, outline: 'closeLast' })),
  makeRectGrillType3: grill((g) => rectGrill(g, { count: 'ln', type: 3, outline: 'closeLast' })),
  makeRectGrillType4: grill((g) => rectGrill(g, { count: 'ln', type: 4, outline: 'closeLast' })),
  makeRectGrillType5: grill((g) => rectGrill(g, { count: 'ln', type: 5, outline: 'closeLast' })),
  makeRectGrillType6: grill((g) => rectGrill(g, { count: 'ln', type: 6, outline: 'closeLast' })),
  makeRectGrillType7: grill((g) => rectGrill(g, { count: 'ln', type: 7, outline: 'closeLast' })),
  makeGrillType1: grill(bladedGrill),
  makeGrillType2: grill(bladedGrill),
  makeGrillType3: grill(bladedGrill),
  makeGrillType4: grill(bladedGrill),
  makeGrillType5: grill(bladedGrill),
  makeGrillType6: grill((g) => rectGrill(g, { count: 'n', type: 6, outline: 'closeLast' })),
  makeGrillType7: grill((g) => rectGrill(g, { count: 'n', type: 7, outline: 'closeLast' })),
};

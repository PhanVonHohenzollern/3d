import earcut from 'earcut';
import { cross, DVec3, normalized } from '@engine/math';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import {
  rotateAroundAxis,
  deg,
  basisFromUp,
  sdkPerpVector,
  toVec,
  toFdVector,
} from '@engine/geometry/helpers/geometryMath';
import { addTriangle, vertex } from '@engine/geometry/helpers/meshData';
import { NamedArguments, type Frame } from '@engine/geometry/helpers/NamedArguments';
import { FrameSketch, MeshSketch } from '@engine/geometry/helpers/sketch';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene, PreviewMesh } from '@engine/geometry/previewScene';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';

type RectGrillOptions = {
  // A fixed lamel count, or the argument that holds it.
  count: number | 'n' | 'ln';
  type: number;
  outline: 'main' | 'closeLast';
};

const invalidGrill = 'invalid grill';
const grillOuterFrameWidth = 30;

// What every framed grill builder shares: the arguments and the grill frame to draw in.
class GrillSketch extends FrameSketch {
  private surface?: PreviewMesh;

  constructor(
    scene: PreviewGeometryScene,
    context: MeshBuildContext,
    readonly a: NamedArguments,
    f: Frame,
  ) {
    super(scene, context, f);
  }

  override fill(points: DVec3[]): void {
    const triangles: number[] = [];
    let normal = new DVec3();
    for (let i = 1; i + 1 < points.length; ++i) {
      const area = cross(points[i].sub(points[0]), points[i + 1].sub(points[0]));
      if (area.x ** 2 + area.y ** 2 + area.z ** 2 <= 1e-18) continue;
      if (triangles.length === 0) normal = normalized(area);
      triangles.push(0, i, i + 1);
    }
    if (triangles.length === 0) return;
    if (!this.surface) {
      this.surface = this.context.createMesh();
      this.scene.meshes.push(this.surface);
    }
    const offset = this.surface.vertices.length;
    for (const point of points) this.surface.vertices.push(vertex(point, normal));
    for (const index of triangles) this.surface.indices.push(offset + index);
  }

  ring(inner: number, outer: number, z: number, count: number): void {
    this.connectRings(inner, z, outer, z, count);
  }

  connectRings(r1: number, z1: number, r2: number, z2: number, count: number): void {
    const p = this.arc(r1, z1, 0, 360, count),
      q = this.arc(r2, z2, 0, 360, count);
    for (let i = 0; i < count; ++i) this.fill(r1 === 0 ? [p[i], q[i], q[i + 1]] : [p[i], q[i], q[i + 1], p[i + 1]]);
  }
}

function grill(build: (g: GrillSketch) => void): ApiMeshAdapter {
  return withAdapterErrors(invalidGrill, (scene, context, args) => {
    const a = new NamedArguments(context, args);
    const f = a.frame();
    if (a.get('upVectorD', 'upVectorF', 'upVector') === undefined) f.up = toVec(sdkPerpVector(toFdVector(f.normal)));
    f.right = cross(f.up, f.normal);
    const pending: PreviewGeometryScene = { meshes: [], warnings: [] };
    build(new GrillSketch(pending, context, a, f));
    scene.meshes.push(...pending.meshes);
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
  if (a.bool(outline, outline === 'main'))
    g.stroke([g.at(-w / 2, -h / 2), g.at(w / 2, -h / 2), g.at(w / 2, h / 2), g.at(-w / 2, h / 2)], true);
}

function framedGrill(type: 6 | 7): ApiMeshAdapter {
  return withAdapterErrors(invalidGrill, (scene, context, args) => {
    const a = new NamedArguments(context, args);
    const center = a.vector('centralPointD'),
      direction = a.fdVector('vectorD'),
      normal = normalized(toVec(direction));
    if (direction.lengthSqrd() === 0) throw new Error('zero normal');
    const hint = a.has('upVectorD') ? a.vector('upVectorD') : toVec(sdkPerpVector(direction));
    const [up] = basisFromUp(normal, hint),
      right = cross(up, normal);
    const w = a.positive('L'),
      h = a.positive('H'),
      count = Math.trunc(a.positive('n'));
    if (count < 1) throw new Error('n must be at least 1');
    const hole = type === 6 ? a.num('a') : 0;
    if (type === 6 && (hole < 0 || count * hole >= h))
      throw new Error('a must be non-negative and n * a must be less than H');
    const band = type === 6 ? (h - count * hole) / (count + 1) : 0;
    const depth = type === 7 ? a.positive('thickness') : 0;
    const angle = type === 7 ? a.num('alfa') : 0;
    if (type === 7 && (angle <= 0 || angle >= 90)) throw new Error('alfa must be between 0 and 90 degrees');
    const run = type === 7 ? depth / Math.tan(deg(angle)) : 0;
    if (type === 7 && run > h) throw new Error('blade depth and angle exceed the grille height');
    const mesh = context.createMesh();
    const outerWidth = w / 2 + grillOuterFrameWidth,
      outerHeight = h / 2 + grillOuterFrameWidth;

    const at = (x: number, y: number, z = 0) => center.add(right.mul(x)).add(up.mul(y)).add(normal.mul(z));

    const face = (points: DVec3[]) => {
      const offset = mesh.vertices.length;
      const n = normalized(cross(points[1].sub(points[0]), points[2].sub(points[0])));
      for (const p of points) mesh.vertices.push(vertex(p, n));
      addTriangle(mesh, offset, offset + 1, offset + 2);
      addTriangle(mesh, offset, offset + 2, offset + 3);
    };

    if (type === 6 && hole === 0) {
      face([
        at(-outerWidth, -outerHeight),
        at(outerWidth, -outerHeight),
        at(outerWidth, outerHeight),
        at(-outerWidth, outerHeight),
      ]);
    } else {
      const ys = [-outerHeight];
      if (type === 6) ys.push(-h / 2);
      const openingRows = new Set<number>();
      const openings = type === 6 ? count : 1;
      const openingWidth = type === 6 ? hole : h;
      for (let i = 0; i < openings; ++i) {
        const bottom = -h / 2 + band + i * (band + openingWidth);
        openingRows.add(ys.length);
        ys.push(bottom, bottom + openingWidth);
      }
      if (type === 6) ys.push(h / 2);
      ys.push(outerHeight);
      const xs = [-outerWidth, -w / 2, w / 2, outerWidth];
      for (const y of ys) for (const x of xs) mesh.vertices.push(vertex(at(x, y), normal));
      for (let row = 0; row + 1 < ys.length; ++row)
        for (let col = 0; col < 3; ++col) {
          if (openingRows.has(row) && col === 1) continue;
          const i = row * 4 + col;
          addTriangle(mesh, i, i + 1, i + 5);
          addTriangle(mesh, i, i + 5, i + 4);
        }
    }
    if (type === 7) {
      const x = w / 2;
      const available = h - run;
      for (let i = 0; i < count; ++i) {
        const y = -h / 2 + (count === 1 ? available / 2 : (i * available) / (count - 1));
        face([at(-x, y), at(x, y), at(x, y + run, depth), at(-x, y + run, depth)]);
      }
    }
    scene.meshes.push(mesh);
  });
}

type Point2 = [number, number];

function circle(radius: number, count: number): Point2[] {
  return Array.from({ length: count }, (_, i) => {
    const theta = (2 * Math.PI * i) / count;

    return [radius * Math.cos(theta), radius * Math.sin(theta)];
  });
}

function circularDimensions(g: GrillSketch) {
  const inner = g.a.num('D1', 0) / 2,
    radius = g.a.positive('D2') / 2,
    outer = g.a.positive('D3') / 2,
    count = 4 * g.a.count('n');
  if (inner < 0 || inner >= radius || outer < radius) throw new Error('require 0 <= D1 < D2 <= D3');

  return { inner, radius, outer, count };
}

function bladeAngle(g: GrillSketch): number {
  const angle = g.a.num('alfa');
  if (angle < 0 || angle >= 90) throw new Error('alfa must be between 0 and 90 degrees');

  return deg(angle);
}

function circSimpleGrill(g: GrillSketch): void {
  const radius = g.a.positive('D') / 2,
    count = 4 * g.a.count('cpx');
  if (g.a.bool('main', true)) g.stroke(g.arc(radius, 0, 0, 360, count), true);
  for (let i = 1; i < 8; ++i) {
    const y = -radius + (2 * radius * i) / 8,
      x = Math.sqrt(radius * radius - y * y);
    g.stroke([g.at(-x, y), g.at(x, y)]);
  }
}

function fanGrill(g: GrillSketch): void {
  const { inner, radius, outer, count } = circularDimensions(g);
  const blades = g.a.count('m'),
    angle = bladeAngle(g);
  if (blades < 3) throw new Error('m must be at least 3');
  if (outer > radius) g.ring(radius, outer, 0, count);
  if (inner > 0) g.ring(0, inner, 0, count);
  for (let i = 0; i < blades; ++i) {
    const begin = (2 * Math.PI * i) / blades;
    const axis = g.f.right.mul(Math.cos(begin)).add(g.f.up.mul(Math.sin(begin)));

    const point = (r: number, theta: number) =>
      g.f.center.add(
        rotateAroundAxis(g.f.right.mul(r * Math.cos(theta)).add(g.f.up.mul(r * Math.sin(theta))), axis, angle),
      );

    const end = begin + (2 * Math.PI) / blades;
    g.fill(
      inner === 0
        ? [g.f.center, point(radius, begin), point(radius, end)]
        : [point(inner, begin), point(radius, begin), point(radius, end), point(inner, end)],
    );
  }
}

function conicalGrill(g: GrillSketch): void {
  const { inner, radius, outer, count } = circularDimensions(g);
  const height = g.a.num('d'),
    flange = g.a.num('flangeHeight');
  if (height < 0 || flange < 0) throw new Error('d and flangeHeight must be non-negative');
  if (outer > radius) g.ring(radius, outer, 0, count);
  if (flange > 0) g.connectRings(outer, -flange, outer, 0, count);
  g.connectRings(inner, height, radius, 0, count);
  if (inner > 0 && g.a.bool('innerCircle', true)) g.ring(0, inner, height, count);
}

function concentricGrill(g: GrillSketch): void {
  const { inner, radius, outer, count } = circularDimensions(g);
  const rings = g.a.count('m'),
    height = g.a.num('h'),
    bladeHeight = g.a.positive('bladeHeight'),
    step = (radius - inner) / rings;
  if (outer > radius) g.ring(radius, outer, 0, count);
  for (let i = 0; i < rings; ++i) {
    const r = radius - i * step,
      top = rings === 1 ? 0 : (height * i) / (rings - 1);
    g.connectRings(r - step, top, r, top - bladeHeight, count);
  }
  if (inner > 0) g.ring(0, inner, rings === 1 ? 0 : height, count);
}

function polygonsOverlap(a: Point2[], b: Point2[]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; ++i) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length];
      const nx = p[1] - q[1],
        ny = q[0] - p[0];
      const pa = a.map(([x, y]) => nx * x + ny * y),
        pb = b.map(([x, y]) => nx * x + ny * y);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }

  return true;
}

function perforatedGrill(g: GrillSketch): void {
  const { inner, radius, outer, count } = circularDimensions(g);
  const holes = g.a.count('m'),
    half = g.a.positive('thickness') / 2,
    angle = bladeAngle(g);
  if (holes < 4) throw new Error('m must be at least 4');
  const width = g.a.bool('rect') ? g.a.positive('L') : 0,
    height = g.a.bool('rect') ? g.a.positive('H') : 0;
  const outline: Point2[] =
    width > 0
      ? [
          [-width / 2, -height / 2],
          [width / 2, -height / 2],
          [width / 2, height / 2],
          [-width / 2, height / 2],
        ]
      : circle(outer, count);
  if (2 * half >= radius - inner) throw new Error('thickness exceeds the radial slot length');
  const start = inner + half,
    end = radius - half;
  const span = -start * Math.cos(angle) + Math.sqrt(end * end - start * start * Math.sin(angle) ** 2);
  const slots: Point2[][] = [];
  for (let i = 0; i < holes; ++i) {
    const theta = (2 * Math.PI * i) / holes;
    const dx = Math.cos(theta + angle),
      dy = Math.sin(theta + angle);
    const x = start * Math.cos(theta),
      y = start * Math.sin(theta);
    const slot: Point2[] = [
      [x + half * dy, y - half * dx],
      [x + span * dx + half * dy, y + span * dy - half * dx],
      [x + span * dx - half * dy, y + span * dy + half * dx],
      [x - half * dy, y + half * dx],
    ];
    for (const [px, py] of slot)
      for (let j = 0; j < outline.length; ++j) {
        const a = outline[j],
          b = outline[(j + 1) % outline.length];
        if ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) <= 1e-9)
          throw new Error('grille slots must fit inside the plate');
      }
    if (slots.some((other) => polygonsOverlap(slot, other))) throw new Error('grille slots overlap');
    slots.push(slot);
  }
  const points = [...outline],
    offsets: number[] = [];
  for (const slot of slots) {
    offsets.push(points.length);
    points.push(...slot);
  }
  const mesh = g.context.createMesh();
  mesh.vertices = points.map(([x, y]) => vertex(g.at(x, y), g.f.normal));
  mesh.indices = earcut(points.flat(), offsets, 2);
  g.scene.meshes.push(mesh);
}

function clipBand(points: Point2[], y: number, above: boolean): Point2[] {
  const result: Point2[] = [];
  for (let i = 0; i < points.length; ++i) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const insideA = above ? a[1] >= y : a[1] <= y,
      insideB = above ? b[1] >= y : b[1] <= y;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push([a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y]);
  }

  return result.filter((p, i) => {
    const q = result[(i + 1) % result.length];

    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
  });
}

function parallelCircularGrill(g: GrillSketch): void {
  const { radius, outer, count } = circularDimensions(g);
  const blades = g.a.count('m') + 2,
    angle = bladeAngle(g);
  if (outer > radius) g.ring(radius, outer, 0, count);
  const outline = circle(radius, count);
  for (let i = 0; i < blades; ++i) {
    const bottom = -radius + (2 * radius * i) / blades,
      top = -radius + (2 * radius * (i + 1)) / blades;
    const points = clipBand(clipBand(outline, bottom, true), top, false);
    if (points.length >= 3)
      g.fill(points.map(([x, y]) => g.at(x, bottom + (y - bottom) * Math.cos(angle), (y - bottom) * Math.sin(angle))));
  }
}

export const grillAdapters: AdapterTable = {
  makeRoseOfWindsLamels: roseOfWindsLamels,
  makeRectSimpleGrill: grill((g) => rectGrill(g, { count: 8, type: 1, outline: 'main' })),
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
  makeGrillType1: grill(fanGrill),
  makeGrillType2: grill(conicalGrill),
  makeGrillType3: grill(concentricGrill),
  makeGrillType4: grill(perforatedGrill),
  makeGrillType5: grill(parallelCircularGrill),
  makeGrillType6: framedGrill(6),
  makeGrillType7: framedGrill(7),
};

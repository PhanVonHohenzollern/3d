import { DVec3, length, normalized } from '@engine/math/DVec3';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import { isArray, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import { MeshSketch } from '@engine/geometry/helpers/sketch';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { basisFromUp, stableBasis, toVec, deg, ellipsePoint } from '@engine/geometry/helpers/geometryMath';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { kMaxListLength, kSymbolArcStepDegrees } from '@engine/geometry/config/previewConstants';

function point(value: RuntimeValue): DVec3 {
  if (value instanceof FdPoint3d || value instanceof FdVector3d) return toVec(value);
  if (isArray(value) && value.elements.length >= 3)
    return new DVec3(...(value.elements.slice(0, 3).map(numeric) as [number, number, number]));
  throw new Error('expected point/vector or ads_point');
}

function numeric(value: RuntimeValue): number {
  if (typeof value !== 'number' && typeof value !== 'bigint' && typeof value !== 'boolean')
    throw new Error('expected number');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('expected finite number');

  return n;
}

// The symbol's own plane: centre c, the supplied in-plane direction u and v across it.
type SymbolPlane = {
  c: DVec3;
  u: DVec3;
  v: DVec3;
  at: (x: number, y: number) => DVec3;
};

type SymbolOutline = SymbolPlane & { h: number; w: number; rectangle: DVec3[] };

// What every symbol builder shares: the arguments and the two ways of drawing.
class SymbolSketch extends MeshSketch {
  constructor(
    scene: PreviewGeometryScene,
    context: MeshBuildContext,
    readonly args: RuntimeValue[],
  ) {
    super(scene, context);
  }

  point(index: number): DVec3 {
    return point(this.args[index]);
  }

  number(index: number): number {
    return numeric(this.args[index]);
  }

  normal(): DVec3 {
    const normal = this.point(1);
    if (length(normal) < 1e-9) throw new Error('zero symbol normal');

    return normal;
  }

  // Centre, normal and in-plane direction are the first three arguments.
  plane(): SymbolPlane {
    const c = this.point(0);
    const normal = this.normal();
    // basisFromUp returns the supplied in-plane direction first.
    const [u, v] = basisFromUp(normal, this.point(2));

    return { c, u, v, at: (x, y) => c.add(v.mul(x)).add(u.mul(y)) };
  }

  // Height and width follow the plane, unless the symbol is square.
  outline(width: 'given' | 'square' = 'given'): SymbolOutline {
    const plane = this.plane();
    const { at } = plane;
    const h = this.number(3),
      w = width === 'square' ? h : this.number(4);
    const rectangle = [at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)];

    return { ...plane, h, w, rectangle };
  }
}

function symbol(build: (s: SymbolSketch) => void): ApiMeshAdapter {
  return withAdapterErrors('invalid symbol arguments', (scene, context, args) => {
    build(new SymbolSketch(scene, context, args));
  });
}

// visVector belongs to the SDK's view-dependent HLR pass. The 3D preview
// displays the stored symbol in its own plane.
function grillSymbol(build: (s: SymbolSketch) => void): ApiMeshAdapter {
  const adapter = symbol(build);

  return (scene, context, args) => adapter(scene, context, args.slice(1));
}

function line(s: SymbolSketch): void {
  s.stroke([s.point(0), s.point(1)]);
}

function vertexArray(s: SymbolSketch, countOffset: number): DVec3[] {
  const vertices = s.args[0];
  if (!isArray(vertices)) throw new Error('expected vertex array');
  const count = s.number(1) + countOffset;
  if (count < 2 || count > vertices.elements.length) throw new Error('vertex count exceeds array');

  return vertices.elements.slice(0, count).map(point);
}

function centerPolyLine(s: SymbolSketch): void {
  s.stroke(vertexArray(s, 1));
}

function polygonalHatch(s: SymbolSketch): void {
  s.fill(vertexArray(s, 0));
}

function circle(s: SymbolSketch, c: DVec3, normal: DVec3, radius: number): void {
  const [u, v] = stableBasis(normalized(normal));
  s.stroke(ellipse(c, u, v, radius, radius, 0, 360));
}

function thinArc(s: SymbolSketch): void {
  const c = s.point(0);
  const radius = s.args.length > 1 ? s.number(1) : 5;
  circle(s, c, new DVec3(0, 0, 1), radius);
}

function circularConnector(s: SymbolSketch): void {
  const c = s.point(0);
  let normal = new DVec3(0, 0, 1);
  let radius = 5;
  if (s.args[1] instanceof FdVector3d) {
    normal = s.point(1);
    radius = s.args.length > 2 ? s.number(2) : 5;
  } else if (s.args.length > 1) radius = s.number(1);
  circle(s, c, normal, radius);
}

function thinCircle(s: SymbolSketch): void {
  const c = s.point(0);
  const normal = s.normal();
  circle(s, c, normal, s.number(2) / 2);
}

function symbolicArc(s: SymbolSketch): void {
  const { c, u, v } = s.plane();
  const radius = s.number(3);
  s.stroke(ellipse(c, u, v, radius, radius, 0, s.number(4)));
}

function centerArc(s: SymbolSketch): void {
  const { c, u, v } = s.plane();
  const radius = s.number(3);
  const begin = s.number(4);
  s.stroke(ellipse(c, u, v, radius, radius, begin, s.number(5)));
}

function symbolicEllipse(s: SymbolSketch): void {
  const { c, u, v } = s.plane();
  const a = s.number(3),
    b = s.number(4);
  const begin = s.number(5);
  s.stroke(ellipse(c, u, v, a, b, begin, s.number(6)));
}

// makeCircleSymbol's kind argument: 1 or 3 plus, 2 minus, 4 triangle, 5 filled triangle.
const circleMarks = { plus: 1, minus: 2, triangle: 4 };

function circleSymbol(s: SymbolSketch, mark: keyof typeof circleMarks | 'fromArgument'): void {
  const { c, u, v, at } = s.plane();
  const r = s.number(3) / 2;
  s.stroke(ellipse(c, u, v, r, r, 0, 360));
  const kind = mark === 'fromArgument' ? s.number(4) : circleMarks[mark];
  if (kind <= 3) s.stroke([at(-r * 0.65, 0), at(r * 0.65, 0)]);
  if (kind === 1 || kind === 3) s.stroke([at(0, -r * 0.65), at(0, r * 0.65)]);
  if (kind >= 4) {
    const triangle = [at(0, r * 0.8), at(-r * 0.7, -r * 0.5), at(r * 0.7, -r * 0.5)];
    if (kind === 5) s.fill(triangle);
    else s.stroke(triangle, true);
  }
}

function slottedHoles(s: SymbolSketch, plane: SymbolPlane, centers: DVec3[], len: number, radius: number): void {
  const { u, v } = plane;
  for (const center of centers) {
    const points = [
      ...ellipse(center.add(u.mul(len / 2)), v, u, radius, radius, 0, 180),
      ...ellipse(center.sub(u.mul(len / 2)), v, u, radius, radius, 180, 360),
    ];
    s.stroke(points, true);
  }
}

function assemblyHole(s: SymbolSketch): void {
  const plane = s.plane();
  slottedHoles(s, plane, [plane.c], s.number(3), s.number(4) / 2);
}

function assemblyHoles(s: SymbolSketch): void {
  const plane = s.plane();
  const spacingX = s.number(3),
    spacingY = s.number(4);
  const centers = [-1, 1].flatMap((x) => [-1, 1].map((y) => plane.at((x * spacingX) / 2, (y * spacingY) / 2)));
  slottedHoles(s, plane, centers, s.number(5), s.number(6) / 2);
}

function rectangle(s: SymbolSketch): void {
  s.stroke(s.outline().rectangle, true);
}

// Four corner points, or the usual centre, normal, direction, height and width.
function cornersOrRectangle(s: SymbolSketch): void {
  if (s.args.length === 4) s.stroke(s.args.map(point), true);
  else rectangle(s);
}

function symbolicRectangle(s: SymbolSketch): void {
  const { rectangle } = s.outline();
  const sides = s.args[5];
  if (isArray(sides))
    rectangle.forEach((p, i) => {
      if (sides.elements[i]) s.stroke([p, rectangle[(i + 1) % 4]]);
    });
  else s.stroke(rectangle, true);
}

function rectHatch(s: SymbolSketch): void {
  s.fill(s.outline().rectangle);
}

function bowTie(s: SymbolSketch, style: 'outline' | 'hatch'): void {
  const { c, rectangle } = s.outline();
  const points = [rectangle[0], rectangle[3], rectangle[1], rectangle[2]];
  if (style === 'hatch') {
    s.fill([points[0], points[1], c]);
    s.fill([points[2], points[3], c]);
  } else s.stroke(points, true);
}

function hourGlass(s: SymbolSketch): void {
  const { rectangle } = s.outline();
  s.stroke([rectangle[0], rectangle[1], rectangle[3], rectangle[2]], true);
}

function infinite(s: SymbolSketch): void {
  const { at, h, w } = s.outline();
  s.stroke(
    Array.from({ length: 129 }, (_, i) => {
      const t = (i * Math.PI) / 64;

      return at(w * 0.5 * Math.cos(t), h * Math.sin(t) * Math.cos(t));
    }),
  );
}

function reversedSigma(s: SymbolSketch): void {
  const { at, h, w } = s.outline();
  s.stroke([at(-w / 2, h / 2), at(w / 2, h / 2), at(0, 0), at(w / 2, -h / 2), at(-w / 2, -h / 2)]);
}

function silencer(s: SymbolSketch): void {
  const { rectangle } = s.outline();
  s.stroke(rectangle, true);
  s.stroke([rectangle[0], rectangle[2]]);
  s.stroke([rectangle[1], rectangle[3]]);
}

function segmentCount(s: SymbolSketch, index: number): number {
  return Math.max(1, Math.min(kMaxListLength, Math.trunc(s.number(index))));
}

function zigZag(s: SymbolSketch): void {
  const { at, h, w } = s.outline();
  const count = segmentCount(s, 5);
  s.stroke(Array.from({ length: count + 1 }, (_, i) => at((i / count - 0.5) * w, ((i % 2) - 0.5) * h)));
}

function dampers(s: SymbolSketch): void {
  const { at, h } = s.outline('square');
  const count = segmentCount(s, 4);
  for (let i = 0; i < count; ++i) s.stroke([at(-h / 2, (i / count - 0.5) * h), at(h / 2, ((i + 1) / count - 0.5) * h)]);
}

function ellipse(c: DVec3, u: DVec3, v: DVec3, a: number, b: number, begin: number, end: number): DVec3[] {
  if (a <= 0 || b <= 0) throw new Error('symbol radii must be positive');
  const count = Math.max(2, Math.min(kMaxListLength, Math.ceil(Math.abs(end - begin) / kSymbolArcStepDegrees)));

  return Array.from({ length: count + 1 }, (_, i) => {
    const t = deg(begin + ((end - begin) * i) / count);

    return ellipsePoint(c, u, v, a, b, t);
  });
}

export const symbolAdapters: AdapterTable = {
  makeSymbolicLine: symbol(line),
  addThinLine: symbol(line),
  drawAsThinLine: symbol(line),
  addCenterLine: symbol(line),
  addCenterPolyLine: symbol(centerPolyLine),
  makeSymbolicArc: symbol(symbolicArc),
  makeSymbolicEllipse: symbol(symbolicEllipse),
  addCenterArc: symbol(centerArc),
  addThinCircle: symbol(thinCircle),
  addThinRect: symbol(rectangle),
  drawRectAsThinLines: symbol(cornersOrRectangle),
  drawAsThinArc: symbol(thinArc),
  addCircularConnector: symbol(circularConnector),
  addRectangularConnector: symbol(cornersOrRectangle),
  addSymbolicFlangeRect: symbol(rectangle),
  addSymbGrillLine: grillSymbol(line),
  addSymbGrillRect: grillSymbol(rectangle),
  addSymbGrillCircle: grillSymbol(thinCircle),
  addSymbGrillArc: grillSymbol(centerArc),
  addSymbGrillEllipse: grillSymbol(symbolicEllipse),
  makeCircleSymbol: symbol((s) => circleSymbol(s, 'fromArgument')),
  makeCircleWithPlus: symbol((s) => circleSymbol(s, 'plus')),
  makeCircleWithMinus: symbol((s) => circleSymbol(s, 'minus')),
  makeCircleWithTriangle: symbol((s) => circleSymbol(s, 'triangle')),
  makeAssemblyHole: symbol(assemblyHole),
  makeAssemblyHoles: symbol(assemblyHoles),
  makeSymbolicRectangle: symbol(symbolicRectangle),
  makePolygonalHatch: symbol(polygonalHatch),
  makeRectHatch: symbol(rectHatch),
  makeBowTieHatch: symbol((s) => bowTie(s, 'hatch')),
  makeBowTie: symbol((s) => bowTie(s, 'outline')),
  makeHourGlass: symbol(hourGlass),
  makeZigZag: symbol(zigZag),
  makeDampers: symbol(dampers),
  makeInfinite: symbol(infinite),
  makeReversedSigma: symbol(reversedSigma),
  makeSilencerSymbol: symbol(silencer),
};

import { DVec3, length, normalized } from '@engine/math';
import { isArray, type RuntimeValue } from '@engine/runtime';
import { MeshSketch } from '@engine/geometry/helpers/sketch';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import { basisFromUp, stableBasis, deg, ellipsePoint } from '@engine/geometry/helpers/geometryMath';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { kMaxListLength, kSymbolArcStepDegrees } from '@engine/geometry/config/previewConstants';

// The symbol's own plane: centre c, the supplied in-plane direction u and v across it.
type SymbolPlane = {
  c: DVec3;
  u: DVec3;
  v: DVec3;
  at: (x: number, y: number) => DVec3;
};

type SymbolOutline = SymbolPlane & { h: number; w: number; rectangle: DVec3[] };

// The parameter names of an arc's in-plane direction and angles, which differ between the APIs.
type ArcNames = { direction: string; begin: string; end: string };

// What every symbol builder shares: the arguments, read by the overload's parameter names, and
// the two ways of drawing. Points and vectors may be FdPoint3d, FdVector3d or 3-number arrays.
class SymbolSketch extends MeshSketch {
  readonly args: NamedArguments;

  constructor(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]) {
    super(scene, context);
    this.args = new NamedArguments(context, args);
  }

  // A finite number: an infinite or NaN size or angle would draw nothing and warn about nothing.
  number(name: string): number {
    const n = this.args.real(name);
    if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);

    return n;
  }

  normal(): DVec3 {
    const normal = this.args.vector('normal');
    if (length(normal) < 1e-9) throw new Error('zero symbol normal');

    return normal;
  }

  // Centre, normal and the in-plane direction named `direction`.
  plane(direction: string): SymbolPlane {
    const c = this.args.vector('center');
    const normal = this.normal();
    // basisFromUp returns the supplied in-plane direction first.
    const [u, v] = basisFromUp(normal, this.args.vector(direction));

    return { c, u, v, at: (x, y) => c.add(v.mul(x)).add(u.mul(y)) };
  }

  // Height and width follow the plane, unless the symbol is square.
  outline(direction: string, width: 'given' | 'square' = 'given'): SymbolOutline {
    const plane = this.plane(direction);
    const { at } = plane;
    const h = this.number('height'),
      w = width === 'square' ? h : this.number('width');
    const rectangle = [at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)];

    return { ...plane, h, w, rectangle };
  }
}

function symbol(build: (s: SymbolSketch) => void): ApiMeshAdapter {
  return withAdapterErrors('invalid symbol arguments', (scene, context, args) => {
    build(new SymbolSketch(scene, context, args));
  });
}

function line(s: SymbolSketch): void {
  s.stroke([s.args.vector('start'), s.args.vector('end')]);
}

function vertexArray(s: SymbolSketch, countName: string, countOffset: number): DVec3[] {
  const vertices = s.args.points('vertices');
  const count = s.number(countName) + countOffset;
  if (count < 2 || count > vertices.length) throw new Error('vertex count exceeds array');

  return vertices.slice(0, count);
}

function centerPolyLine(s: SymbolSketch): void {
  s.stroke(vertexArray(s, 'numOfLines', 1));
}

function polygonalHatch(s: SymbolSketch): void {
  s.fill(vertexArray(s, 'n', 0));
}

function circle(s: SymbolSketch, c: DVec3, normal: DVec3, radius: number): void {
  const [u, v] = stableBasis(normalized(normal));
  s.stroke(ellipse(c, u, v, radius, radius, 0, 360));
}

// Overloads without a radius draw one of 5.
function optionalRadius(s: SymbolSketch): number {
  return s.args.has('radius') ? s.number('radius') : 5;
}

function thinArc(s: SymbolSketch): void {
  circle(s, s.args.vector('center'), new DVec3(0, 0, 1), optionalRadius(s));
}

function circularConnector(s: SymbolSketch): void {
  const normal = s.args.has('normal') ? s.args.vector('normal') : new DVec3(0, 0, 1);
  circle(s, s.args.vector('center'), normal, optionalRadius(s));
}

function thinCircle(s: SymbolSketch): void {
  const c = s.args.vector('center');
  const normal = s.normal();
  circle(s, c, normal, s.number('diameter') / 2);
}

function symbolicArc(s: SymbolSketch): void {
  const { c, u, v } = s.plane('radVect');
  const radius = s.number('radius');
  s.stroke(ellipse(c, u, v, radius, radius, 0, s.number('angle')));
}

function centerArc(s: SymbolSketch, names: ArcNames, angleScale = 1): void {
  const { c, u, v } = s.plane(names.direction);
  const radius = s.number('radius');
  const begin = s.number(names.begin) * angleScale;
  s.stroke(ellipse(c, u, v, radius, radius, begin, s.number(names.end) * angleScale));
}

function symbolicEllipse(s: SymbolSketch, names: ArcNames): void {
  const { c, u, v } = s.plane(names.direction);
  const a = s.number('radiusA'),
    b = s.number('radiusB');
  const begin = s.number(names.begin);
  s.stroke(ellipse(c, u, v, a, b, begin, s.number(names.end)));
}

// makeCircleSymbol's kind argument: 1 or 3 plus, 2 minus, 4 triangle, 5 filled triangle.
const circleMarks = { plus: 1, minus: 2, triangle: 4 };

function circleSymbol(s: SymbolSketch, mark: keyof typeof circleMarks | 'fromArgument'): void {
  const { c, u, v, at } = s.plane('upVector');
  const r = s.number('diam') / 2;
  s.stroke(ellipse(c, u, v, r, r, 0, 360));
  const kind = mark === 'fromArgument' ? s.number('symbType') : circleMarks[mark];
  if (kind <= 3) s.stroke([at(-r * 0.65, 0), at(r * 0.65, 0)]);
  if (kind === 1 || kind === 3) s.stroke([at(0, -r * 0.65), at(0, r * 0.65)]);
  if (kind >= 4) {
    const triangle = [at(0, r * 0.8), at(-r * 0.7, -r * 0.5), at(r * 0.7, -r * 0.5)];
    if (kind === 5) s.fill(triangle);
    else s.stroke(triangle, true);
  }
}

function slottedHoles(s: SymbolSketch, plane: SymbolPlane, centers: DVec3[]): void {
  const { u, v } = plane;
  const len = s.number('Len'),
    radius = s.number('holeWidth') / 2;
  for (const center of centers) {
    const points = [
      ...ellipse(center.add(u.mul(len / 2)), v, u, radius, radius, 0, 180),
      ...ellipse(center.sub(u.mul(len / 2)), v, u, radius, radius, 180, 360),
    ];
    s.stroke(points, true);
  }
}

function assemblyHole(s: SymbolSketch): void {
  const plane = s.plane('upVector');
  slottedHoles(s, plane, [plane.c]);
}

function assemblyHoles(s: SymbolSketch): void {
  const plane = s.plane('upVector');
  const spacingX = s.number('L'),
    spacingY = s.number('H');
  const centers = [-1, 1].flatMap((x) => [-1, 1].map((y) => plane.at((x * spacingX) / 2, (y * spacingY) / 2)));
  slottedHoles(s, plane, centers);
}

function rectangle(s: SymbolSketch, direction = 'upVector'): void {
  s.stroke(s.outline(direction).rectangle, true);
}

// Four corner points, or the usual centre, normal, direction, height and width.
function cornersOrRectangle(s: SymbolSketch): void {
  if (s.args.has('p1'))
    s.stroke(
      ['p1', 'p2', 'p3', 'p4'].map((name) => s.args.vector(name)),
      true,
    );
  else rectangle(s);
}

// A missing or malformed sides array draws the whole outline.
function symbolicRectangle(s: SymbolSketch): void {
  const { rectangle } = s.outline('upVector');
  if (!isArray(s.args.get('sides'))) {
    s.stroke(rectangle, true);

    return;
  }
  const sides = s.args.flagArray('sides');
  rectangle.forEach((p, i) => {
    if (sides[i]) s.stroke([p, rectangle[(i + 1) % 4]]);
  });
}

function rectHatch(s: SymbolSketch): void {
  s.fill(s.outline('upVector').rectangle);
}

function bowTie(s: SymbolSketch, style: 'outline' | 'hatch'): void {
  const { c, rectangle } = s.outline('upVector');
  const points = [rectangle[0], rectangle[3], rectangle[1], rectangle[2]];
  if (style === 'hatch') {
    s.fill([points[0], points[1], c]);
    s.fill([points[2], points[3], c]);
  } else s.stroke(points, true);
}

function hourGlass(s: SymbolSketch): void {
  const { rectangle } = s.outline('upVector');
  s.stroke([rectangle[0], rectangle[1], rectangle[3], rectangle[2]], true);
}

function infinite(s: SymbolSketch): void {
  const { at, h, w } = s.outline('upVector');
  s.stroke(
    Array.from({ length: 129 }, (_, i) => {
      const t = (i * Math.PI) / 64;

      return at(w * 0.5 * Math.cos(t), h * Math.sin(t) * Math.cos(t));
    }),
  );
}

function reversedSigma(s: SymbolSketch): void {
  const { at, h, w } = s.outline('upVector');
  s.stroke([at(-w / 2, h / 2), at(w / 2, h / 2), at(0, 0), at(w / 2, -h / 2), at(-w / 2, -h / 2)]);
}

function silencer(s: SymbolSketch): void {
  const { rectangle } = s.outline('upVector');
  s.stroke(rectangle, true);
  s.stroke([rectangle[0], rectangle[2]]);
  s.stroke([rectangle[1], rectangle[3]]);
}

function segmentCount(s: SymbolSketch): number {
  return Math.max(1, Math.min(kMaxListLength, Math.trunc(s.number('n'))));
}

function zigZag(s: SymbolSketch): void {
  const { at, h, w } = s.outline('upVector');
  const count = segmentCount(s);
  s.stroke(Array.from({ length: count + 1 }, (_, i) => at((i / count - 0.5) * w, ((i % 2) - 0.5) * h)));
}

function dampers(s: SymbolSketch): void {
  const { at, h } = s.outline('upVector', 'square');
  const count = segmentCount(s);
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
  makeSymbolicEllipse: symbol((s) =>
    symbolicEllipse(s, { direction: 'radVect', begin: 'startAngle', end: 'endAngle' }),
  ),
  addCenterArc: symbol((s) =>
    centerArc(s, { direction: 'radiusVector', begin: 'startAngle', end: 'endAngle' }, 180 / Math.PI),
  ),
  addThinCircle: symbol(thinCircle),
  addThinRect: symbol(rectangle),
  drawRectAsThinLines: symbol(cornersOrRectangle),
  drawAsThinArc: symbol(thinArc),
  addCircularConnector: symbol(circularConnector),
  addRectangularConnector: symbol(cornersOrRectangle),
  addSymbolicFlangeRect: symbol(rectangle),
  // The grill symbols' leading visVector belongs to the SDK's view-dependent HLR pass. The 3D
  // preview displays the stored symbol in its own plane and does not read it.
  addSymbGrillLine: symbol(line),
  addSymbGrillRect: symbol((s) => rectangle(s, 'upVect')),
  addSymbGrillCircle: symbol(thinCircle),
  addSymbGrillArc: symbol((s) => centerArc(s, { direction: 'radVec', begin: 'startAng', end: 'endAng' })),
  addSymbGrillEllipse: symbol((s) => symbolicEllipse(s, { direction: 'radAVec', begin: 'startAng', end: 'endAng' })),
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

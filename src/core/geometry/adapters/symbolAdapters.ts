import { cross, DVec3, length, normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import { isArray, type RuntimeValue } from '../../runtime/RuntimeValue';
import { buildPolygonFaceMesh } from '../builders/rectangularMeshes';
import { warningFor } from '../helpers/apiCall';
import { basisFromUp, stableBasis, toPoint, toVec } from '../helpers/geometryMath';
import { vertex } from '../helpers/meshData';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

// Symbols are narrow ribbons in the preview's triangle-only renderer. Their
// centre lines retain SDK coordinates; stroke width is a display property.
export function appendStroke(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  points: DVec3[],
  closed = false,
): void {
  const mesh = context.createMesh();
  for (let i = 1; i < points.length + Number(closed); ++i) {
    const a = points[i - 1],
      b = points[i % points.length];
    const axis = b.sub(a);
    if (length(axis) < 1e-9) continue;
    const [u, v] = stableBasis(normalized(axis));
    // Two crossed ribbons keep a line visible when viewed edge-on.
    for (const offset of [u.mul(0.35), v.mul(0.35)]) {
      const start = mesh.vertices.length;
      const normal = normalized(cross(axis, offset));
      mesh.vertices.push(...[a.sub(offset), b.sub(offset), b.add(offset), a.add(offset)].map((p) => vertex(p, normal)));
      mesh.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }
  if (mesh.indices.length) scene.meshes.push(mesh);
}

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

export const symbolApiNames = [
  'makeSymbolicLine',
  'addThinLine',
  'drawAsThinLine',
  'addCenterLine',
  'make_line',
  'make_thin_line',
  'addCenterPolyLine',
  'makeSymbolicArc',
  'makeSymbolicEllipse',
  'addCenterArc',
  'addThinCircle',
  'addThinRect',
  'drawRectAsThinLines',
  'drawAsThinArc',
  'addCircularConnector',
  'addRectangularConnector',
  'addSymbolicFlangeRect',
  'addSymbGrillLine',
  'addSymbGrillRect',
  'addSymbGrillCircle',
  'addSymbGrillArc',
  'addSymbGrillEllipse',
  'makeCircleSymbol',
  'makeCircleWithPlus',
  'makeCircleWithMinus',
  'makeCircleWithTriangle',
  'makeAssemblyHole',
  'makeAssemblyHoles',
  'makeSymbolicRectangle',
  'makePolygonalHatch',
  'makeRectHatch',
  'makeBowTieHatch',
  'makeBowTie',
  'makeHourGlass',
  'makeZigZag',
  'makeDampers',
  'makeInfinite',
  'makeReversedSigma',
  'makeSilencerSymbol',
] as const;

export function appendSymbol(scene: PreviewGeometryScene, context: MeshBuildContext, input: RuntimeValue[]): boolean {
  let name = context.call.name;
  let args = input;
  if (name.startsWith('addSymbGrill')) {
    // visVector belongs to the SDK's view-dependent HLR pass. The 3D preview
    // displays the stored symbol in its own plane.
    args = args.slice(1);
    name = (
      {
        Line: 'makeSymbolicLine',
        Rect: 'addThinRect',
        Circle: 'addThinCircle',
        Arc: 'addCenterArc',
        Ellipse: 'makeSymbolicEllipse',
      } as Record<string, string>
    )[name.slice(12)];
  }

  const stroke = (points: DVec3[], closed = false) => appendStroke(scene, context, points, closed);

  const fill = (points: DVec3[]) => scene.meshes.push(buildPolygonFaceMesh(context, points.map(toPoint)));

  try {
    if (
      ['makeSymbolicLine', 'addThinLine', 'drawAsThinLine', 'addCenterLine', 'make_line', 'make_thin_line'].includes(
        name,
      )
    ) {
      stroke([point(args[0]), point(args[1])]);

      return true;
    }
    if (name === 'addCenterPolyLine' || name === 'makePolygonalHatch') {
      if (!isArray(args[0])) throw new Error('expected vertex array');
      const count = numeric(args[1]) + Number(name === 'addCenterPolyLine');
      if (count < 2 || count > args[0].elements.length) throw new Error('vertex count exceeds array');
      const points = args[0].elements.slice(0, count).map(point);
      if (name === 'makePolygonalHatch') fill(points);
      else stroke(points);

      return true;
    }
    if (args.length === 4 && ['drawRectAsThinLines', 'addRectangularConnector'].includes(name)) {
      stroke(args.map(point), true);

      return true;
    }
    const c = point(args[0]);
    let normal = new DVec3(0, 0, 1);
    let u: DVec3, v: DVec3;
    if (name === 'drawAsThinArc' || name === 'addCircularConnector') {
      let radius = 5;
      if (name === 'drawAsThinArc') radius = args.length > 1 ? numeric(args[1]) : 5;
      else if (args[1] instanceof FdVector3d) {
        normal = point(args[1]);
        radius = args.length > 2 ? numeric(args[2]) : 5;
      } else if (args.length > 1) radius = numeric(args[1]);
      [u, v] = stableBasis(normalized(normal));
      stroke(ellipse(c, u, v, radius, radius, 0, 360));

      return true;
    }
    normal = point(args[1]);
    if (length(normal) < 1e-9) throw new Error('zero symbol normal');
    if (name === 'addThinCircle') {
      [u, v] = stableBasis(normalized(normal));
      stroke(ellipse(c, u, v, numeric(args[2]) / 2, numeric(args[2]) / 2, 0, 360));

      return true;
    }
    [u, v] = basisFromUp(normal, point(args[2]));
    // basisFromUp returns the supplied in-plane direction first.
    if (['makeSymbolicArc', 'makeSymbolicEllipse', 'addCenterArc'].includes(name)) {
      const a = numeric(args[3]);
      const b = name === 'makeSymbolicEllipse' ? numeric(args[4]) : a;
      const begin = name === 'makeSymbolicArc' ? 0 : numeric(args[name === 'makeSymbolicEllipse' ? 5 : 4]);
      const end = numeric(args[name === 'makeSymbolicEllipse' ? 6 : name === 'makeSymbolicArc' ? 4 : 5]);
      stroke(ellipse(c, u, v, a, b, begin, end));

      return true;
    }

    const at = (x: number, y: number) => c.add(v.mul(x)).add(u.mul(y));

    if (name.startsWith('makeCircle')) {
      const r = numeric(args[3]) / 2;
      stroke(ellipse(c, u, v, r, r, 0, 360));
      const kind =
        name === 'makeCircleSymbol'
          ? numeric(args[4])
          : name === 'makeCircleWithMinus'
            ? 2
            : name === 'makeCircleWithPlus'
              ? 1
              : 4;
      if (kind <= 3) stroke([at(-r * 0.65, 0), at(r * 0.65, 0)]);
      if (kind === 1 || kind === 3) stroke([at(0, -r * 0.65), at(0, r * 0.65)]);
      if (kind >= 4) {
        const triangle = [at(0, r * 0.8), at(-r * 0.7, -r * 0.5), at(r * 0.7, -r * 0.5)];
        if (kind === 5) fill(triangle);
        else stroke(triangle, true);
      }

      return true;
    }
    if (name === 'makeAssemblyHole' || name === 'makeAssemblyHoles') {
      const offsets =
        name === 'makeAssemblyHole'
          ? [c]
          : [-1, 1].flatMap((x) => [-1, 1].map((y) => at((x * numeric(args[3])) / 2, (y * numeric(args[4])) / 2)));
      const len = numeric(args[name === 'makeAssemblyHole' ? 3 : 5]);
      const radius = numeric(args[name === 'makeAssemblyHole' ? 4 : 6]) / 2;
      for (const center of offsets) {
        const points = [
          ...ellipse(center.add(u.mul(len / 2)), v, u, radius, radius, 0, 180),
          ...ellipse(center.sub(u.mul(len / 2)), v, u, radius, radius, 180, 360),
        ];
        stroke(points, true);
      }

      return true;
    }
    const h = numeric(args[3]),
      w = name === 'makeDampers' ? h : numeric(args[4]);
    const rectangle = [at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)];
    if (
      [
        'addThinRect',
        'drawRectAsThinLines',
        'addRectangularConnector',
        'addSymbolicFlangeRect',
        'makeSymbolicRectangle',
        'makeRectHatch',
      ].includes(name)
    ) {
      if (name === 'makeRectHatch') fill(rectangle);
      else if (name === 'makeSymbolicRectangle' && isArray(args[5])) {
        const sides = args[5];
        rectangle.forEach((p, i) => {
          if (sides.elements[i]) stroke([p, rectangle[(i + 1) % 4]]);
        });
      } else stroke(rectangle, true);

      return true;
    }
    if (['makeBowTie', 'makeHourGlass', 'makeBowTieHatch'].includes(name)) {
      const points =
        name === 'makeHourGlass'
          ? [rectangle[0], rectangle[1], rectangle[3], rectangle[2]]
          : [rectangle[0], rectangle[3], rectangle[1], rectangle[2]];
      if (name === 'makeBowTieHatch') {
        fill([points[0], points[1], c]);
        fill([points[2], points[3], c]);
      } else stroke(points, true);

      return true;
    }
    if (name === 'makeInfinite') {
      stroke(
        Array.from({ length: 129 }, (_, i) => {
          const t = (i * Math.PI) / 64;

          return at(w * 0.5 * Math.cos(t), h * Math.sin(t) * Math.cos(t));
        }),
      );

      return true;
    }
    if (name === 'makeReversedSigma') {
      stroke([at(-w / 2, h / 2), at(w / 2, h / 2), at(0, 0), at(w / 2, -h / 2), at(-w / 2, -h / 2)]);

      return true;
    }
    if (name === 'makeSilencerSymbol') {
      stroke(rectangle, true);
      stroke([rectangle[0], rectangle[2]]);
      stroke([rectangle[1], rectangle[3]]);

      return true;
    }
    if (name === 'makeZigZag' || name === 'makeDampers') {
      const count = Math.max(1, Math.min(4096, Math.trunc(numeric(args[name === 'makeDampers' ? 4 : 5]))));
      if (name === 'makeZigZag')
        stroke(Array.from({ length: count + 1 }, (_, i) => at((i / count - 0.5) * w, ((i % 2) - 0.5) * h)));
      else
        for (let i = 0; i < count; ++i)
          stroke([at(-h / 2, (i / count - 0.5) * h), at(h / 2, ((i + 1) / count - 0.5) * h)]);

      return true;
    }

    return false;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid symbol arguments'));

    return true;
  }
}

function ellipse(c: DVec3, u: DVec3, v: DVec3, a: number, b: number, begin: number, end: number): DVec3[] {
  if (a <= 0 || b <= 0) throw new Error('symbol radii must be positive');
  const count = Math.max(2, Math.min(4096, Math.ceil(Math.abs(end - begin) / 3)));

  return Array.from({ length: count + 1 }, (_, i) => {
    const t = ((begin + ((end - begin) * i) / count) * Math.PI) / 180;

    return c.add(u.mul(a * Math.cos(t))).add(v.mul(b * Math.sin(t)));
  });
}

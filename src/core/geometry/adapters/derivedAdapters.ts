import { cross, DVec3, normalized } from '../../../utils/DVec3';
import { FdBowlInfo } from '../../runtime/FdBowlData';
import { RuntimeArray, type RuntimeValue } from '../../runtime/RuntimeValue';
import { buildBoxMesh, buildPolygonFaceMesh } from '../builders/rectangularMeshes';
import { warningFor } from '../helpers/apiCall';
import { rotateAroundAxis, toFdVector, toPoint } from '../helpers/geometryMath';
import { NamedArguments } from '../helpers/NamedArguments';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendBowl } from './bowlAdapters';
import { appendStroke } from './symbolAdapters';

export const derivedApiNames = [
  'makeBend',
  'makeBend2',
  'makeRectBend',
  'makeSymetricBend',
  'makeEllipticalPlane',
  'makeBowlWC',
  'makeBowlSink',
  'makeBowlBath',
  'makeBowlShower',
  'makeAlizeFront',
] as const;

export function appendDerived(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  try {
    const a = new NamedArguments(context, args),
      name = context.call.name;
    if (name === 'makeAlizeFront') {
      const w = a.positive('bh'),
        h = a.positive('L'),
        inset = a.num('bh1'),
        step = a.num('bh2'),
        depth = a.num('lx');
      const points = [
        new DVec3(-w / 2, 0, 0),
        new DVec3(w / 2, 0, 0),
        new DVec3(w / 2 - inset, 0, h - step),
        new DVec3(0, depth, h),
        new DVec3(-w / 2 + inset, 0, h - step),
      ];
      scene.meshes.push(buildPolygonFaceMesh(context, points.map(toPoint)));
      const r = a.positive('D1') / 2;
      appendStroke(
        scene,
        context,
        Array.from(
          { length: 65 },
          (_, i) => new DVec3(r * Math.cos((i * Math.PI) / 32), depth, r * Math.sin((i * Math.PI) / 32) + h / 2),
        ),
      );

      return true;
    }
    const f = a.frame();
    if (name === 'makeEllipticalPlane') {
      const r1 = a.positive('R1'),
        r2 = a.positive('R2'),
        count = 4 * a.count('n');
      scene.meshes.push(
        buildPolygonFaceMesh(
          context,
          Array.from({ length: count }, (_, i) =>
            toPoint(
              f.center
                .add(f.up.mul(r1 * Math.cos((2 * Math.PI * i) / count)))
                .add(f.right.mul(r2 * Math.sin((2 * Math.PI * i) / count))),
            ),
          ),
        ),
      );

      return true;
    }
    if (name.startsWith('makeBowl')) {
      const w = a.positive('width'),
        l = a.positive('length'),
        h = a.positive('height');
      // Dimensions describe the rim envelope. Shape proportions are inferred
      // from the named sanitary fixture (there are no profile tables in SDK headers).
      const profile =
        name === 'makeBowlShower'
          ? [0.86, 0.86, 0.06]
          : name === 'makeBowlBath'
            ? [0.72, 0.82, 0.2]
            : name === 'makeBowlWC'
              ? [0.48, 0.6, 0.42]
              : [0.58, 0.65, 0.32];
      const bowl = new FdBowlInfo(4, a.count('nComplexityR'), a.count('nComplexityV'));
      const vertical = toFdVector(f.normal),
        direction = toFdVector(f.up);
      bowl.faces[0].initAsRectangle(vertical, direction, toPoint(f.center), [w, l]);
      bowl.faces[1].initAsRectangle(
        vertical,
        direction,
        toPoint(f.center.sub(f.normal.mul(h))),
        [w * profile[0], l * profile[1]],
        true,
      );
      bowl.faces.forEach((face) =>
        face.corners.forEach((c) => {
          c.radii = [Math.min(w, l) * profile[2], Math.min(w, l) * profile[2]];
        }),
      );

      return appendBowl(scene, context, [bowl]);
    }
    if (a.get('outEllipse') !== undefined) throw new Error('AcDbEllipse output overload requires a native CAD object');
    if (!a.bool('draw', true)) return true;
    const w0 = a.positive('beginWidth'),
      w1 = a.positive('endWidth'),
      h = a.positive('Height');
    const r0 = a.num('R11'),
      r1 = a.num('R12', r0);
    if (r0 < 0 || r1 < 0) throw new Error('bend radii cannot be negative');
    const sweep = (a.num('alfa', 90) * Math.PI) / 180,
      count = a.count('complexity');
    if (Math.abs(sweep) < 1e-9) throw new Error('bend angle must be nonzero');
    const turn = f.right.mul(a.bool('reverse') ? -1 : 1);
    const axis = normalized(cross(f.normal, turn));
    const radius0 = r0 + w0 / 2,
      radius1 = r1 + w1 / 2;
    const centers = [],
      normals = [],
      ups = [],
      widths = [],
      heights = [];
    const lead = a.num('beginLength', 0),
      tail = a.num('endBox', 0);
    for (let i = 0; i <= count; ++i) {
      const t = i / count,
        theta = t * sweep;
      const p = f.center
        .add(f.normal.mul(lead + radius0 * Math.sin(theta)))
        .add(turn.mul(radius1 * (1 - Math.cos(theta))));
      centers.push(toPoint(p));
      normals.push(toFdVector(rotateAroundAxis(f.normal, axis, theta)));
      ups.push(toFdVector(f.up));
      widths.push(w0 + (w1 - w0) * t);
      heights.push(h);
    }
    if (lead > 0) {
      centers.unshift(toPoint(f.center));
      normals.unshift(toFdVector(f.normal));
      ups.unshift(toFdVector(f.up));
      widths.unshift(w0);
      heights.unshift(h);
    }
    if (tail > 0) {
      const last = centers.at(-1)!;
      centers.push(last.add(normals.at(-1)!.mul(tail)));
      normals.push(normals.at(-1)!);
      ups.push(ups.at(-1)!);
      widths.push(w1);
      heights.push(h);
    }
    const sides = a.get('sides');
    const visible = sides instanceof RuntimeArray ? sides.elements.slice(0, 4).map(Boolean) : [true, true, true, true];
    scene.meshes.push(
      buildBoxMesh(
        context,
        centers.length - 1,
        centers,
        normals,
        ups,
        widths,
        heights,
        Array.from({ length: centers.length - 1 }, () => visible).flat(),
        false,
        false,
      ),
    );
    if (a.bool('endCon')) {
      const c = centers.at(-1)!,
        n = normals.at(-1)!;
      const u = f.up.mul(h / 2),
        r = normalized(cross(new DVec3(n.x, n.y, n.z), f.up)).mul(w1 / 2),
        p = new DVec3(c.x, c.y, c.z);
      appendStroke(scene, context, [p.add(u).add(r), p.add(u).sub(r), p.sub(u).sub(r), p.sub(u).add(r)], true);
    }

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid derived geometry'));

    return true;
  }
}

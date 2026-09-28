import { cross, DVec3, normalized } from '@engine/math/DVec3';
import { FdBowlInfo } from '@engine/runtime/FdBowlData';
import { RuntimeArray } from '@engine/runtime/RuntimeValue';
import { buildBoxMesh, buildPolygonFaceMesh } from '@engine/geometry/builders/rectangularMeshes';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { toFdVector, toPoint, deg, sweepAlongArc } from '@engine/geometry/helpers/geometryMath';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import { appendBowlMeshes } from '@engine/geometry/builders/bowlMeshes';
import { appendStroke } from '@engine/geometry/builders/strokeMeshes';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';

// Rim-to-bottom width and length ratios, and the corner radius ratio, of a sanitary bowl.
type BowlProfile = readonly [number, number, number];

// What every derived builder shares. The frame is read by each builder, not here, because
// makeAlizeFront never reads one.
type DerivedSketch = {
  readonly scene: PreviewGeometryScene;
  readonly context: MeshBuildContext;
  readonly a: NamedArguments;
};

function derived(build: (d: DerivedSketch) => void): ApiMeshAdapter {
  return withAdapterErrors('invalid derived geometry', (scene, context, args) =>
    build({ scene, context, a: new NamedArguments(context, args) }),
  );
}

function alizeFront({ scene, context, a }: DerivedSketch): void {
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
}

function ellipticalPlane({ scene, context, a }: DerivedSketch): void {
  const f = a.frame();
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
}

// Dimensions describe the rim envelope. Shape proportions are inferred from the sanitary fixture
// (there are no profile tables in SDK headers).
function sanitaryBowl({ scene, context, a }: DerivedSketch, profile: BowlProfile): void {
  const f = a.frame();
  const w = a.positive('width'),
    l = a.positive('length'),
    h = a.positive('height');
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

  appendBowlMeshes(scene, context, bowl, undefined, false);
}

function bend({ scene, context, a }: DerivedSketch): void {
  const f = a.frame();
  if (a.get('outEllipse') !== undefined) throw new Error('AcDbEllipse output overload requires a native CAD object');
  if (!a.bool('draw', true)) return;
  const w0 = a.positive('beginWidth'),
    w1 = a.positive('endWidth'),
    h = a.positive('Height');
  const r0 = a.num('R11'),
    r1 = a.num('R12', r0);
  if (r0 < 0 || r1 < 0) throw new Error('bend radii cannot be negative');
  const sweep = deg(a.num('alfa', 90)),
    count = a.count('complexity');
  if (Math.abs(sweep) < 1e-9) throw new Error('bend angle must be nonzero');
  const turn = f.right.mul(a.bool('reverse') ? -1 : 1);
  const radius0 = r0 + w0 / 2,
    radius1 = r1 + w1 / 2;
  const centers = [],
    normals = [],
    ups = [],
    widths = [],
    heights = [];
  const lead = a.num('beginLength', 0),
    tail = a.num('endBox', 0);
  for (const section of sweepAlongArc(f.center, f.normal, turn, lead, radius0, radius1, sweep, count)) {
    centers.push(toPoint(section.center));
    normals.push(toFdVector(section.normal));
    ups.push(toFdVector(f.up));
    widths.push(w0 + (w1 - w0) * section.t);
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
    buildBoxMesh(context, {
      count: centers.length - 1,
      centers,
      normals,
      upVectors: ups,
      widths,
      heights,
      visibleSides: Array.from({ length: centers.length - 1 }, () => visible).flat(),
    }),
  );
  if (a.bool('endCon')) {
    const c = centers.at(-1)!,
      n = normals.at(-1)!;
    const u = f.up.mul(h / 2),
      r = normalized(cross(new DVec3(n.x, n.y, n.z), f.up)).mul(w1 / 2),
      p = new DVec3(c.x, c.y, c.z);
    appendStroke(scene, context, [p.add(u).add(r), p.add(u).sub(r), p.sub(u).sub(r), p.sub(u).add(r)], true);
  }
}

export const derivedAdapters: AdapterTable = {
  makeBend: derived(bend),
  makeBend2: derived(bend),
  makeRectBend: derived(bend),
  makeSymetricBend: derived(bend),
  makeEllipticalPlane: derived(ellipticalPlane),
  makeBowlWC: derived((d) => sanitaryBowl(d, [0.48, 0.6, 0.42])),
  makeBowlSink: derived((d) => sanitaryBowl(d, [0.58, 0.65, 0.32])),
  makeBowlBath: derived((d) => sanitaryBowl(d, [0.72, 0.82, 0.2])),
  makeBowlShower: derived((d) => sanitaryBowl(d, [0.86, 0.86, 0.06])),
  makeAlizeFront: derived(alizeFront),
};

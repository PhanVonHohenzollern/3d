import { cross, dot, DVec3, length, normalized } from '@engine/math';
import { FdBowlInfo, RuntimeArray } from '@engine/runtime';
import { buildAnnulusMesh } from '@engine/geometry/builders/circularMeshes';
import {
  buildBendProfileMesh,
  buildBendStripMesh,
  buildBoxMesh,
  buildPolygonFaceMesh,
} from '@engine/geometry/builders/rectangularMeshes';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { toFdVector, toPoint, toVec, deg, sdkPerpVector, sweepAlongArc } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
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
  const center = a.vector('centralPoint');
  const direction = a.fdVector('vector');
  const normal = normalized(toVec(a.has('upVector') ? a.fdVector('upVector') : sdkPerpVector(direction)));
  // The SDK's bend starts on upVector x vector (that is, -vector x upVector).
  const start = normalized(cross(normal, toVec(direction)));
  if (length(normal) < 1e-9 || length(start) < 1e-9)
    throw new Error('vector and upVector must be nonzero and nonparallel');
  const innerRadius = a.positive('R1'),
    outerRadius = a.positive('R2'),
    segments = a.count('n');
  if (outerRadius <= innerRadius) throw new Error('R2 must be greater than R1');
  scene.meshes.push(
    buildAnnulusMesh(context, center, normal, [start, cross(normal, start)], innerRadius, outerRadius, segments),
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

function bend2({ scene, context, a }: DerivedSketch): void {
  if (a.get('outEllipse') !== undefined) throw new Error('AcDbEllipse output overload requires a native CAD object');
  if (!a.bool('draw', true)) return;
  const f = a.frame();
  const w0 = a.positive('beginWidth'),
    w1 = a.positive('endWidth'),
    h = a.num('Height'),
    r0 = a.num('R11'),
    r1 = a.num('R12', r0);
  if (h < 0 || r0 < 0 || r1 < 0) throw new Error('bend height and radii cannot be negative');
  const alpha = deg(a.num('alfa', 90)),
    beta = deg(a.num('beta', a.num('alfa', 90))),
    count = a.count('complexity');
  if (Math.abs(alpha) < 1e-9 || Math.abs(beta) < 1e-9) throw new Error('bend angle must be nonzero');
  const turn = f.right;
  const origin = f.center.add(turn.mul(r0 + w0 / 2));

  const at = (a: number, b: number, angle: number): DVec3 => {
    // Bend2 ends on the requested radial angle, not the ellipse's parameter angle.
    const parameter = a > 0 && b > 0 ? Math.atan2(a * Math.sin(angle), b * Math.cos(angle)) : angle;

    return origin.sub(turn.mul(a * Math.cos(parameter))).sub(f.normal.mul(b * Math.sin(parameter)));
  };

  const centers = [],
    normals = [],
    ups = [],
    widths = [],
    heights = [];
  for (let i = 0; i <= count; ++i) {
    const inner = at(r0, r1, (alpha * i) / count),
      outer = at(r0 + w0, r1 + w1, (beta * i) / count);
    centers.push(toPoint(inner.add(outer).mul(0.5)));
    normals.push(toFdVector(normalized(cross(f.up, outer.sub(inner)))));
    ups.push(toFdVector(f.up));
    widths.push(length(outer.sub(inner)));
    heights.push(h);
  }
  const sides = a.get('sides');
  const visible = sides instanceof RuntimeArray ? sides.elements.slice(0, 4).map(Boolean) : [true, true, true, true];
  const mesh = buildBoxMesh(context, {
    count,
    centers,
    normals,
    upVectors: ups,
    widths,
    heights,
    visibleSides: Array.from({ length: count }, () => visible).flat(),
  });
  if (a.bool('reverse')) {
    // Reverse the sweep across the inlet plane, keeping the inlet and ellipse center fixed.
    const reflect = (v: DVec3) => v.sub(f.normal.mul(2 * dot(v, f.normal)));

    mesh.vertices = mesh.vertices.map((v) =>
      vertex(f.center.add(reflect(new DVec3(v.x, v.y, v.z).sub(f.center))), reflect(new DVec3(v.nx, v.ny, v.nz))),
    );
    for (let i = 0; i < mesh.indices.length; i += 3)
      [mesh.indices[i + 1], mesh.indices[i + 2]] = [mesh.indices[i + 2], mesh.indices[i + 1]];
  }
  scene.meshes.push(mesh);
}

function symetricBend({ scene, context, a }: DerivedSketch): void {
  const angle = deg(a.num('alfa'));
  if (angle <= 0) return;
  if (angle >= Math.PI) throw new Error('bend angle must be less than 180 degrees');
  const center = a.vector('centralPoint');
  const normal = normalized(a.vector('vector'));
  const up = normalized(a.vector('upVector'));
  const right = normalized(cross(normal, up));
  if (length(right) < 1e-9) throw new Error('vector and upVector must be nonzero and nonparallel');
  const beginWidth = a.positive('beginWidth'),
    endWidth = a.positive('endWidth'),
    height = a.num('Height'),
    innerRadius = a.num('R11'),
    outerRadius = a.num('R12', innerRadius),
    lead = a.num('beginLength'),
    count = a.count('complexity'),
    sides = a.flagArray('sides');
  if (height < 0 || innerRadius < 0 || outerRadius < 0) throw new Error('bend height and radii cannot be negative');
  if (sides.length < 4) throw new Error('sides needs 4 booleans');
  const travel = cross(up, right).mul(a.bool('reverse') ? 1 : -1);

  const radial = (theta: number) => right.mul(-Math.cos(theta)).add(travel.mul(Math.sin(theta)));

  const innerCenter = center.add(right.mul(beginWidth / 2 + innerRadius));
  const innerStart = center.add(right.mul(beginWidth / 2));
  const outerStart = center.sub(right.mul(beginWidth / 2));
  const innerEnd = innerCenter.add(radial(angle).mul(innerRadius));
  const outerEnd = innerCenter.add(radial(angle).mul(innerRadius + endWidth));
  const startTangent = cross(radial(0), up),
    endTangent = cross(radial(angle), up);
  const distance = dot(cross(outerEnd.sub(outerStart), endTangent), up) / dot(cross(startTangent, endTangent), up);
  const intersection = outerStart.add(startTangent.mul(distance));
  // The SDK bisects the rays from the tangent intersection toward B2 and E2.
  const bisector = normalized(normalized(outerStart.sub(intersection)).add(normalized(outerEnd.sub(intersection))));
  if (length(bisector) < 1e-9) throw new Error('outer bend center is undefined');
  const outerCenter = intersection.add(bisector.mul(outerRadius / Math.sin((Math.PI - angle) / 2)));

  const arc = (origin: DVec3, radius: number) =>
    Array.from({ length: count + 1 }, (_, i) => origin.add(radial((angle * i) / count).mul(radius)));

  const inner = [innerStart.add(normal.mul(lead)), ...arc(innerCenter, innerRadius), innerEnd];
  const outer = [outerStart.add(normal.mul(lead)), ...arc(outerCenter, outerRadius), outerEnd];
  scene.meshes.push(buildBendStripMesh(context, inner, outer, up, height, sides));
}

function rectBend({ scene, context, a }: DerivedSketch): void {
  const f = a.frame();
  const w0 = a.positive('beginWidth'),
    w1 = a.positive('endWidth'),
    height = a.num('Height');
  const innerRadius = a.num('R11');
  const angle = deg(90);
  const count = a.count('complexity');
  const sides = a.flagArray('sides');
  if (height < 0 || innerRadius < 0) throw new Error('bend height and radius cannot be negative');
  if (sides.length < 4) throw new Error('sides needs 4 booleans');
  const travel = f.normal.mul(a.bool('reverse') ? 1 : -1);
  const c = Math.cos(angle),
    s = Math.sin(angle);

  const toWorld = (x: number, y: number) => f.center.add(f.right.mul(x)).add(travel.mul(y));

  const centerX = w0 / 2 + innerRadius;
  const innerEnd = toWorld(centerX - innerRadius * c, innerRadius * s);
  const outerEnd = toWorld(centerX - (innerRadius + w1) * c, (innerRadius + w1) * s);
  const outerLead = (innerRadius + w1 - (w0 + innerRadius) * c) / s;
  const arc = Array.from({ length: innerRadius === 0 ? 1 : count + 1 }, (_, i) => {
    const theta = (angle * i) / count;

    return toWorld(centerX - innerRadius * Math.cos(theta), innerRadius * Math.sin(theta));
  });

  const inner = [toWorld(w0 / 2, 0), ...arc, innerEnd];
  const outer = [toWorld(-w0 / 2, 0), toWorld(-w0 / 2, outerLead), outerEnd];
  scene.meshes.push(buildBendProfileMesh(context, inner, outer, f.up, height, sides));
  if (a.bool('endCon')) {
    const up = f.up.mul(height / 2);
    appendStroke(scene, context, [innerEnd.add(up), outerEnd.add(up), outerEnd.sub(up), innerEnd.sub(up)], true);
  }
}

export const derivedAdapters: AdapterTable = {
  makeBend: derived(bend),
  makeBend2: derived(bend2),
  makeRectBend: derived(rectBend),
  makeSymetricBend: derived(symetricBend),
  makeEllipticalPlane: derived(ellipticalPlane),
  makeBowlWC: derived((d) => sanitaryBowl(d, [0.48, 0.6, 0.42])),
  makeBowlSink: derived((d) => sanitaryBowl(d, [0.58, 0.65, 0.32])),
  makeBowlBath: derived((d) => sanitaryBowl(d, [0.72, 0.82, 0.2])),
  makeBowlShower: derived((d) => sanitaryBowl(d, [0.86, 0.86, 0.06])),
  makeAlizeFront: derived(alizeFront),
};

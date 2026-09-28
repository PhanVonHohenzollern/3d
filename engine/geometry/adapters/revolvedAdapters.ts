import { normalized } from '@engine/math/DVec3';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';
import {
  buildCircleOutlineMesh,
  buildDiscMesh,
  buildFacettedCylinderMesh,
  buildRingMesh,
  buildSpheroidSectionMesh,
  buildTorusSectionMesh,
} from '@engine/geometry/builders/circularMeshes';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import {
  kEps,
  sdkPerpVector,
  toFdVector,
  toPoint,
  toVec,
  validDirection,
  circularFaceCount,
  stableBasis,
} from '@engine/geometry/helpers/geometryMath';
import { pushNonEmptyMesh } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable } from '@engine/geometry/adapters/types';

function appendFlatDisc(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('center'),
    normal = a.fdVector('normal'),
    diameter = a.real('diameter'),
    segments = a.int('n');
  if (!validDirection(normal) || diameter <= 0.0 || segments < 1) throw new Error('invalid disc dimensions/normal');
  scene.meshes.push(buildDiscMesh(context, center, normal, diameter, segments));
}

function appendFlatRing(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('center'),
    normal = a.fdVector('normal'),
    innerDiameter = a.real('innerDiam'),
    outerDiameter = a.real('outerDiam'),
    segments = a.int('n');
  if (
    !validDirection(normal) ||
    innerDiameter < 0.0 ||
    outerDiameter < 0.0 ||
    Math.abs(innerDiameter - outerDiameter) <= kEps ||
    segments < 1
  )
    throw new Error('invalid ring dimensions/normal');
  scene.meshes.push(buildRingMesh(context, center, normal, innerDiameter, outerDiameter, segments));
}

function appendDisc(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('center'),
    normal = a.fdVector('normal'),
    diameter = a.real('diameter'),
    thickness = a.real('thickness'),
    segments = a.int('n');
  // Checked like the SDK's bool, though the preview does not use it.
  a.flag('segment');
  if (!validDirection(normal) || diameter <= 0.0 || thickness < 0.0 || segments < 1)
    throw new Error('invalid disc dimensions/normal');
  const n = normalized(toVec(normal));
  const c = toVec(center);
  const [up] = stableBasis(n);
  const start = toPoint(c.sub(n.mul(thickness * 0.5)));
  const end = toPoint(c.add(n.mul(thickness * 0.5)));
  scene.meshes.push(
    buildFacettedCylinderMesh(
      context,
      start,
      end,
      toFdVector(up),
      diameter,
      0.0,
      360.0,
      circularFaceCount(segments),
      true,
      true,
    ),
  );
}

function appendSymbolicCircle(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('center'),
    normal = a.fdVector('normal'),
    diameter = a.real('diam');
  if (!validDirection(normal) || diameter <= 0.0) throw new Error('invalid symbolic-circle dimensions/normal');
  scene.meshes.push(buildCircleOutlineMesh(context, center, normal, diameter));
}

function appendDonutSection(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('center'),
    normal = a.fdVector('normal'),
    radVec = a.fdVector('radVec'),
    radius = a.real('radius'),
    diameter = a.real('diameter'),
    sweep = a.real('sweepAngle'),
    complexity = a.int('n'),
    segmentation = a.int('segmentation');
  if (
    !validDirection(normal) ||
    !validDirection(radVec) ||
    radius < 0.0 ||
    diameter <= 0.0 ||
    complexity < 1 ||
    segmentation < 1 ||
    Math.abs(sweep) <= kEps
  )
    throw new Error('invalid donut dimensions/vectors');
  scene.meshes.push(
    buildTorusSectionMesh(context, center, normal, radVec, radius, diameter, sweep, complexity, segmentation),
  );
}

function appendTubularBend(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('center'),
    normal = a.fdVector('normal'),
    radiusVector = a.fdVector('radiusVector'),
    radius = a.real('radius'),
    diameter = a.real('diameter'),
    sweep = a.real('sweepAngle'),
    n = a.int('n'),
    segmentation = a.int('segmentation');
  // Checked like the SDK's bool, though the preview does not use it.
  a.flag('segment');
  const half = a.flag('half');
  if (
    !validDirection(normal) ||
    !validDirection(radiusVector) ||
    radius < 0.0 ||
    diameter <= 0.0 ||
    n < 1 ||
    segmentation < 1 ||
    Math.abs(sweep) <= kEps
  )
    throw new Error('invalid tubular-bend dimensions/vectors');
  pushNonEmptyMesh(
    scene,
    buildTorusSectionMesh(context, center, normal, radiusVector, radius, diameter, sweep, n, segmentation, half),
  );
}

// The overload without bVector takes the SDK's perpendicular to the normal.
function appendSpheroidSection(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): void {
  const a = new NamedArguments(context, args);
  const center = a.point('centroid'),
    normal = a.fdVector('normal'),
    bVector = a.has('bVector') ? a.fdVector('bVector') : sdkPerpVector(normal),
    latAngles = a.realArray('latAngles'),
    longAngles = a.realArray('longAngles'),
    diameters = a.realArray('diams'),
    complexity = a.intArray('n');
  if (
    latAngles.length < 2 ||
    longAngles.length < 2 ||
    diameters.length < 3 ||
    complexity.length < 2 ||
    !validDirection(normal) ||
    !validDirection(bVector)
  )
    throw new Error('invalid spheroid arguments');
  scene.meshes.push(
    buildSpheroidSectionMesh(context, center, normal, bVector, latAngles, longAngles, diameters, complexity),
  );
}

export const revolvedPrimitiveAdapters: AdapterTable = {
  makeFlatDisc: withAdapterErrors('invalid disc arguments', appendFlatDisc),
  makeFlatRing: withAdapterErrors('invalid ring arguments', appendFlatRing),
  makeDisc: withAdapterErrors('invalid disc arguments', appendDisc),
  makeDonutSection: withAdapterErrors('invalid donut arguments', appendDonutSection),
  makeSpheroidSection: withAdapterErrors('invalid spheroid arguments', appendSpheroidSection),
  makeSymbolicCircle: withAdapterErrors('invalid symbolic-circle arguments', appendSymbolicCircle),
};

export const revolvedCompositeAdapters: AdapterTable = {
  makeTubularBend: withAdapterErrors('invalid tubular-bend arguments', appendTubularBend),
};

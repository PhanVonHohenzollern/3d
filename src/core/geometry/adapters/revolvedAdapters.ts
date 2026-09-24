import { normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import {
  buildCircleOutlineMesh,
  buildDiscMesh,
  buildFacettedCylinderMesh,
  buildRingMesh,
  buildSpheroidSectionMesh,
  buildTorusSectionMesh,
} from '../builders/circularMeshes';
import { warningFor } from '../helpers/apiCall';
import {
  kEps,
  sdkPerpVector,
  toFdVector,
  toPoint,
  toVec,
  validDirection,
  circularFaceCount,
  stableBasis,
} from '../helpers/geometryMath';
import { pushNonEmptyMesh } from '../helpers/meshData';
import { asBool, asInt, asNumber, asPoint, asVector, intArray, numberArray, ref } from '../helpers/valueDecoding';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

export function appendFlatDisc(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  if (args.length !== 4) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d());
  const diameter = ref(0.0);
  const segments = ref(0);
  if (
    !asPoint(args[0], center) ||
    !asVector(args[1], normal) ||
    !asNumber(args[2], diameter) ||
    !asInt(args[3], segments)
  ) {
    scene.warnings.push(warningFor(call, 'invalid disc arguments'));
    return true;
  }
  if (!validDirection(normal.v) || diameter.v <= 0.0 || segments.v < 1) {
    scene.warnings.push(warningFor(call, 'invalid disc dimensions/normal'));
    return true;
  }
  scene.meshes.push(buildDiscMesh(context, center.v, normal.v, diameter.v, segments.v));
  return true;
}

export function appendFlatRing(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  if (args.length !== 5) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d());
  const innerDiameter = ref(0.0),
    outerDiameter = ref(0.0);
  const segments = ref(0);
  if (
    !asPoint(args[0], center) ||
    !asVector(args[1], normal) ||
    !asNumber(args[2], innerDiameter) ||
    !asNumber(args[3], outerDiameter) ||
    !asInt(args[4], segments)
  ) {
    scene.warnings.push(warningFor(call, 'invalid ring arguments'));
    return true;
  }
  if (
    !validDirection(normal.v) ||
    innerDiameter.v < 0.0 ||
    outerDiameter.v < 0.0 ||
    Math.abs(innerDiameter.v - outerDiameter.v) <= kEps ||
    segments.v < 1
  ) {
    scene.warnings.push(warningFor(call, 'invalid ring dimensions/normal'));
    return true;
  }
  scene.meshes.push(buildRingMesh(context, center.v, normal.v, innerDiameter.v, outerDiameter.v, segments.v));
  return true;
}

export function appendDisc(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  if (args.length !== 6) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d());
  const diameter = ref(0.0),
    thickness = ref(0.0);
  const segments = ref(0);
  const segment = ref(false);
  if (
    !asPoint(args[0], center) ||
    !asVector(args[1], normal) ||
    !asNumber(args[2], diameter) ||
    !asNumber(args[3], thickness) ||
    !asInt(args[4], segments) ||
    !asBool(args[5], segment)
  ) {
    scene.warnings.push(warningFor(call, 'invalid disc arguments'));
    return true;
  }
  if (!validDirection(normal.v) || diameter.v <= 0.0 || thickness.v < 0.0 || segments.v < 1) {
    scene.warnings.push(warningFor(call, 'invalid disc dimensions/normal'));
    return true;
  }
  const n = normalized(toVec(normal.v));
  const c = toVec(center.v);
  const [up] = stableBasis(n);
  const start = toPoint(c.sub(n.mul(thickness.v * 0.5)));
  const end = toPoint(c.add(n.mul(thickness.v * 0.5)));
  scene.meshes.push(
    buildFacettedCylinderMesh(
      context,
      start,
      end,
      toFdVector(up),
      diameter.v,
      0.0,
      360.0,
      circularFaceCount(segments.v),
      true,
      true,
    ),
  );
  return true;
}

export function appendSymbolicCircle(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length !== 3) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d());
  const diameter = ref(0.0);
  if (!asPoint(args[0], center) || !asVector(args[1], normal) || !asNumber(args[2], diameter)) {
    scene.warnings.push(warningFor(call, 'invalid symbolic-circle arguments'));
    return true;
  }
  if (!validDirection(normal.v) || diameter.v <= 0.0) {
    scene.warnings.push(warningFor(call, 'invalid symbolic-circle dimensions/normal'));
    return true;
  }
  scene.meshes.push(buildCircleOutlineMesh(context, center.v, normal.v, diameter.v));
  return true;
}

export function appendDonutSection(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length !== 8) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d()),
    radVec = ref(new FdVector3d());
  const radius = ref(0.0),
    diameter = ref(0.0),
    sweep = ref(0.0);
  const complexity = ref(0),
    segmentation = ref(0);
  if (
    !asPoint(args[0], center) ||
    !asVector(args[1], normal) ||
    !asVector(args[2], radVec) ||
    !asNumber(args[3], radius) ||
    !asNumber(args[4], diameter) ||
    !asNumber(args[5], sweep) ||
    !asInt(args[6], complexity) ||
    !asInt(args[7], segmentation)
  ) {
    scene.warnings.push(warningFor(call, 'invalid donut arguments'));
    return true;
  }
  if (
    !validDirection(normal.v) ||
    !validDirection(radVec.v) ||
    radius.v < 0.0 ||
    diameter.v <= 0.0 ||
    complexity.v < 1 ||
    segmentation.v < 1 ||
    Math.abs(sweep.v) <= kEps
  ) {
    scene.warnings.push(warningFor(call, 'invalid donut dimensions/vectors'));
    return true;
  }
  scene.meshes.push(
    buildTorusSectionMesh(
      context,
      center.v,
      normal.v,
      radVec.v,
      radius.v,
      diameter.v,
      sweep.v,
      complexity.v,
      segmentation.v,
    ),
  );
  return true;
}

export function appendTubularBend(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length < 8) return false;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d()),
    radiusVector = ref(new FdVector3d());
  const radius = ref(0.0),
    diameter = ref(0.0),
    sweep = ref(0.0);
  const n = ref(0),
    segmentation = ref(0);
  const segment = ref(true),
    half = ref(false);
  if (
    !asPoint(args[0], center) ||
    !asVector(args[1], normal) ||
    !asVector(args[2], radiusVector) ||
    !asNumber(args[3], radius) ||
    !asNumber(args[4], diameter) ||
    !asNumber(args[5], sweep) ||
    !asInt(args[6], n) ||
    !asInt(args[7], segmentation) ||
    (args.length > 8 && !asBool(args[8], segment)) ||
    (args.length > 9 && !asBool(args[9], half))
  )
    return false;
  if (half.v) return false;
  if (
    !validDirection(normal.v) ||
    !validDirection(radiusVector.v) ||
    radius.v < 0.0 ||
    diameter.v <= 0.0 ||
    n.v < 1 ||
    segmentation.v < 1 ||
    Math.abs(sweep.v) <= kEps
  )
    return false;
  pushNonEmptyMesh(
    scene,
    buildTorusSectionMesh(
      context,
      center.v,
      normal.v,
      radiusVector.v,
      radius.v,
      diameter.v,
      sweep.v,
      n.v,
      segmentation.v,
    ),
  );
  return true;
}

export function appendSpheroidSection(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length !== 7 && args.length !== 6) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d()),
    bVector = ref(new FdVector3d());
  const latAngles: number[] = [],
    longAngles: number[] = [],
    diameters: number[] = [];
  const complexity: number[] = [];
  const withBVector = args.length === 7;
  const latIndex = withBVector ? 3 : 2;
  let ok = asPoint(args[0], center) && asVector(args[1], normal);
  if (withBVector) ok = ok && asVector(args[2], bVector);
  else bVector.v = sdkPerpVector(normal.v);
  ok =
    ok &&
    numberArray(args[latIndex], latAngles) &&
    numberArray(args[latIndex + 1], longAngles) &&
    numberArray(args[latIndex + 2], diameters) &&
    intArray(args[latIndex + 3], complexity);
  if (
    !ok ||
    latAngles.length < 2 ||
    longAngles.length < 2 ||
    diameters.length < 3 ||
    complexity.length < 2 ||
    !validDirection(normal.v) ||
    !validDirection(bVector.v)
  ) {
    scene.warnings.push(warningFor(call, 'invalid spheroid arguments'));
    return true;
  }
  scene.meshes.push(
    buildSpheroidSectionMesh(context, center.v, normal.v, bVector.v, latAngles, longAngles, diameters, complexity),
  );
  return true;
}

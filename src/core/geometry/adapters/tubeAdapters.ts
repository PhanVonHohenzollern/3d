import { stdMax } from '../../../utils/cppStd';
import { DVec3, length, normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildSectionTubeMesh, buildTaperedTubeMesh } from '../builders/circularMeshes';
import { warningFor } from '../helpers/apiCall';
import { kEps, sdkPerpVector, toFdVector, toVec, validDirection } from '../helpers/geometryMath';
import { pushNonEmptyMesh } from '../helpers/meshData';
import {
  asBool,
  asInt,
  asNumber,
  asPoint,
  asVector,
  numberArray,
  numberMatrix,
  pointArray,
  ref,
  twoPointsFromArray,
  vectorArray,
} from '../helpers/valueDecoding';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

export function appendVerySimpleTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const call = context.call;
  const start = ref(new FdPoint3d()),
    end = ref(new FdPoint3d());
  const diameter = ref(0.0);
  const segments = ref(0);
  let ok = false;
  if (args.length === 4) {
    ok = asPoint(args[0], start) && asPoint(args[1], end) && asNumber(args[2], diameter) && asInt(args[3], segments);
  } else if (args.length === 3) {
    ok = twoPointsFromArray(args[0], start, end) && asNumber(args[1], diameter) && asInt(args[2], segments);
  }
  if (!ok) {
    scene.warnings.push(warningFor(call, 'unsupported or invalid arguments'));

    return true;
  }
  if (diameter.v <= 0.0 || segments.v < 1 || length(toVec(end.v).sub(toVec(start.v))) <= kEps) {
    scene.warnings.push(warningFor(call, 'invalid tube dimensions'));

    return true;
  }
  scene.meshes.push(buildTaperedTubeMesh(context, start.v, end.v, diameter.v, diameter.v, segments.v));

  return true;
}

export function appendSimpleTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const call = context.call;
  const start = ref(new FdPoint3d()),
    end = ref(new FdPoint3d());
  const diameter1 = ref(0.0),
    diameter2 = ref(0.0);
  const segments = ref(0);
  let ok = false;
  if (args.length === 5) {
    ok =
      asPoint(args[0], start) &&
      asPoint(args[1], end) &&
      asNumber(args[2], diameter1) &&
      asNumber(args[3], diameter2) &&
      asInt(args[4], segments);
  } else if (args.length === 4) {
    ok =
      twoPointsFromArray(args[0], start, end) &&
      asNumber(args[1], diameter1) &&
      asNumber(args[2], diameter2) &&
      asInt(args[3], segments);
  }
  if (!ok) {
    scene.warnings.push(warningFor(call, 'unsupported or invalid arguments'));

    return true;
  }
  if (diameter1.v <= 0.0 || diameter2.v <= 0.0 || segments.v < 1 || length(toVec(end.v).sub(toVec(start.v))) <= kEps) {
    scene.warnings.push(warningFor(call, 'invalid simple-tube dimensions'));

    return true;
  }
  scene.meshes.push(buildTaperedTubeMesh(context, start.v, end.v, diameter1.v, diameter2.v, segments.v));

  return true;
}

export function appendTube(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  if (args.length !== 8 && args.length !== 7) return false;
  const call = context.call;
  const centers: FdPoint3d[] = [];
  const normals: FdVector3d[] = [],
    upVectors: FdVector3d[] = [];
  const diameters: number[][] = [];
  const complexity = ref(0),
    numOfSegs = ref(0);
  const half = ref(false),
    segment = ref(false);
  const withUpVectors = args.length === 8;
  const complexityIndex = withUpVectors ? 4 : 3;
  let ok = pointArray(args[0], centers) && vectorArray(args[1], normals);
  if (withUpVectors) ok = ok && vectorArray(args[2], upVectors) && numberMatrix(args[3], diameters);
  else ok = ok && numberMatrix(args[2], diameters);
  ok =
    ok &&
    asInt(args[complexityIndex], complexity) &&
    asInt(args[complexityIndex + 1], numOfSegs) &&
    asBool(args[complexityIndex + 2], half) &&
    asBool(args[complexityIndex + 3], segment);
  if (!ok) {
    scene.warnings.push(warningFor(call, 'invalid makeTube arguments'));

    return true;
  }
  const sections = stdMax(0, numOfSegs.v) + 1;
  if (
    numOfSegs.v < 1 ||
    complexity.v < 1 ||
    centers.length < sections ||
    normals.length < sections ||
    diameters.length < sections
  ) {
    scene.warnings.push(warningFor(call, 'makeTube arrays must contain numOfSegs+1 sections'));

    return true;
  }
  if (upVectors.length === 0) {
    for (let section = 0; section < sections; ++section) {
      upVectors.push(sdkPerpVector(normals[section]));
    }
  }
  if (upVectors.length < sections) {
    scene.warnings.push(warningFor(call, 'makeTube up-vector array is too small'));

    return true;
  }
  let validDiameters = true;
  for (let section = 0; section < sections; ++section)
    validDiameters = validDiameters && diameters[section].length >= 2;
  if (!validDiameters) {
    scene.warnings.push(warningFor(call, 'makeTube diameters require [][2]'));

    return true;
  }
  scene.meshes.push(
    buildSectionTubeMesh(context, centers, normals, upVectors, diameters, complexity.v, numOfSegs.v, half.v),
  );

  return true;
}

export function appendStraightTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length < 4) return false;
  const centers: FdPoint3d[] = [];
  const diams: number[] = [];
  const n = ref(0),
    numOfSegs = ref(0);
  const segment = ref(true);
  if (
    !pointArray(args[0], centers) ||
    !numberArray(args[1], diams) ||
    !asInt(args[2], n) ||
    !asInt(args[3], numOfSegs) ||
    (args.length > 4 && !asBool(args[4], segment))
  )
    return false;
  const sections = stdMax(0, numOfSegs.v) + 1;
  if (numOfSegs.v < 1 || n.v < 1 || centers.length < sections || diams.length < sections) return false;

  let axis = toVec(centers[1]).sub(toVec(centers[0]));
  if (length(axis) <= kEps) axis = new DVec3(1, 0, 0);
  const normal = toFdVector(normalized(axis));
  const up = sdkPerpVector(normal);
  const normals = new Array<FdVector3d>(sections).fill(normal),
    ups = new Array<FdVector3d>(sections).fill(up);
  const diameters: number[][] = [];
  for (let i = 0; i < sections; ++i) diameters[i] = [diams[i], diams[i]];
  pushNonEmptyMesh(scene, buildSectionTubeMesh(context, centers, normals, ups, diameters, n.v, numOfSegs.v, false));

  return true;
}

export function appendUniVectorTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length < 5) return false;
  const centers: FdPoint3d[] = [];
  const normal = ref(new FdVector3d());
  const diams: number[] = [];
  const n = ref(0),
    numOfSegs = ref(0);
  const segment = ref(true);
  if (
    !pointArray(args[0], centers) ||
    !asVector(args[1], normal) ||
    !numberArray(args[2], diams) ||
    !asInt(args[3], n) ||
    !asInt(args[4], numOfSegs) ||
    (args.length > 5 && !asBool(args[5], segment))
  )
    return false;
  const sections = stdMax(0, numOfSegs.v) + 1;
  if (numOfSegs.v < 1 || n.v < 1 || !validDirection(normal.v) || centers.length < sections || diams.length < sections)
    return false;
  const up = sdkPerpVector(normal.v);
  const normals = new Array<FdVector3d>(sections).fill(normal.v),
    ups = new Array<FdVector3d>(sections).fill(up);
  const diameters: number[][] = [];
  for (let i = 0; i < sections; ++i) diameters[i] = [diams[i], diams[i]];
  pushNonEmptyMesh(scene, buildSectionTubeMesh(context, centers, normals, ups, diameters, n.v, numOfSegs.v, false));

  return true;
}

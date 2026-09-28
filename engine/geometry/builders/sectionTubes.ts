import { stdMax } from '@engine/runtime/cpp/cppStd';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';
import { buildSectionTubeMesh } from '@engine/geometry/builders/circularMeshes';
import { warningFor } from '@engine/geometry/helpers/apiCall';
import { sdkPerpVector } from '@engine/geometry/helpers/geometryMath';
import { asBool, asInt, numberMatrix, pointArray, ref, vectorArray } from '@engine/geometry/helpers/valueDecoding';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// makeTube: sections given by centre, normal, optional up vector and [][2] diameters. Shared with
// makeTruncatedTube, which clips the result.
export function appendSectionTube(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
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

import { normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildSectionTubeMesh } from '../builders/circularMeshes';
import {
  buildRectTubeIntersectionMeshes,
  buildRectToEllipseTransitionMesh,
  rectangleCorners,
} from '../builders/transitionMeshes';
import { warningFor } from '../helpers/apiCall';
import { kEps, sdkPerpVector, toPoint, toVec, validDirection } from '../helpers/geometryMath';
import { pushNonEmptyMesh } from '../helpers/meshData';
import { asInt, asPoint, asVector, numberArray, pointArray, ref } from '../helpers/valueDecoding';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

export function appendRectToTubeTransition(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const call = context.call;
  if (args.length !== 7) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeTransition expects 7 evaluated arguments'));

    return true;
  }

  const start = ref(new FdPoint3d()),
    tubeStart = ref(new FdPoint3d());
  const normal = ref(new FdVector3d()),
    upVector = ref(new FdVector3d());
  const tubeDiams: number[] = [];
  const complexity = ref(0);
  const hasComplexity = asInt(args[6], complexity);
  if (
    !asPoint(args[0], start) ||
    !asVector(args[1], normal) ||
    !asVector(args[2], upVector) ||
    !asPoint(args[4], tubeStart) ||
    !numberArray(args[5], tubeDiams)
  ) {
    scene.warnings.push(
      warningFor(call, 'makeRectToTubeTransition position/orientation/dimension arguments could not be evaluated'),
    );

    return true;
  }
  if (!hasComplexity) {
    complexity.v = 10;
    scene.warnings.push(
      warningFor(call, 'makeRectToTubeTransition complexity is unresolved; using preview tessellation n=10'),
    );
  }
  if (
    !validDirection(normal.v) ||
    !validDirection(upVector.v) ||
    tubeDiams.length < 3 ||
    tubeDiams[0] <= 0.0 ||
    tubeDiams[1] <= 0.0 ||
    Math.abs(tubeDiams[2]) <= kEps ||
    complexity.v < 1
  ) {
    scene.warnings.push(
      warningFor(call, 'makeRectToTubeTransition has invalid normal/upVector, tube diameters or tube length'),
    );

    return true;
  }

  let corners: FdPoint3d[] = [];
  if (!pointArray(args[3], corners)) {
    const heightWidth: number[] = [];
    if (
      !numberArray(args[3], heightWidth) ||
      heightWidth.length < 2 ||
      heightWidth[0] <= 0.0 ||
      heightWidth[1] <= 0.0
    ) {
      scene.warnings.push(warningFor(call, 'makeRectToTubeTransition requires corners[4] or positive heightWidth[2]'));

      return true;
    }
    corners = rectangleCorners(start.v, normal.v, upVector.v, heightWidth[0], heightWidth[1]);
  }
  if (corners.length < 4) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeTransition corners array must contain four points'));

    return true;
  }
  corners.length = 4;

  const transition = buildRectToEllipseTransitionMesh(
    context,
    corners,
    start.v,
    normal.v,
    upVector.v,
    tubeStart.v,
    tubeDiams[0],
    tubeDiams[1],
    complexity.v,
  );
  transition.apiName += '.transition';
  if (transition.vertices.length === 0 || transition.indices.length === 0) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeTransition could not build the rectangle-to-ellipse loft'));

    return true;
  }
  pushNonEmptyMesh(scene, transition);

  const n = normalized(toVec(normal.v));
  const tubeEnd = toPoint(toVec(tubeStart.v).add(n.mul(tubeDiams[2])));
  const centers = [tubeStart.v, tubeEnd];
  const normals = [normal.v, normal.v];
  const ups = [upVector.v, upVector.v];
  const diameters = [
    [tubeDiams[0], tubeDiams[1]],
    [tubeDiams[0], tubeDiams[1]],
  ];
  const tube = buildSectionTubeMesh(context, centers, normals, ups, diameters, complexity.v, 1, false);
  tube.apiName += '.tube';
  if (tube.vertices.length === 0 || tube.indices.length === 0) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeTransition could not build the elliptical tube'));

    return true;
  }
  pushNonEmptyMesh(scene, tube);

  return true;
}

export function appendRectToTubeIntersection(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  const call = context.call;
  if (args.length !== 6 && args.length !== 7) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeIntersection expects 6 or 7 evaluated arguments'));

    return true;
  }
  const start = ref(new FdPoint3d());
  const normal = ref(new FdVector3d()),
    upVector = ref(new FdVector3d());
  const tubeParams: number[] = [],
    ductPosition: number[] = [],
    ductParams: number[] = [];
  const complexity = ref(0);

  const withUpVector = args.length === 7;
  const tubeIndex = withUpVector ? 3 : 2;
  if (!asPoint(args[0], start) || !asVector(args[1], normal)) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeIntersection start/normal could not be evaluated'));

    return true;
  }
  if (withUpVector) {
    if (!asVector(args[2], upVector)) {
      scene.warnings.push(warningFor(call, 'makeRectToTubeIntersection upVector could not be evaluated'));

      return true;
    }
  } else {
    upVector.v = sdkPerpVector(normal.v);
  }
  if (
    !numberArray(args[tubeIndex], tubeParams) ||
    !numberArray(args[tubeIndex + 1], ductPosition) ||
    !numberArray(args[tubeIndex + 2], ductParams) ||
    !asInt(args[tubeIndex + 3], complexity)
  ) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeIntersection array arguments could not be evaluated'));

    return true;
  }
  if (
    !validDirection(normal.v) ||
    !validDirection(upVector.v) ||
    tubeParams.length < 3 ||
    ductPosition.length < 2 ||
    ductParams.length < 3 ||
    tubeParams[0] <= 0.0 ||
    tubeParams[1] <= 0.0 ||
    Math.abs(tubeParams[2]) <= kEps ||
    ductParams[0] <= 0.0 ||
    ductParams[1] <= 0.0 ||
    Math.abs(ductParams[2]) <= kEps ||
    complexity.v < 1
  ) {
    scene.warnings.push(warningFor(call, 'makeRectToTubeIntersection has invalid dimensions, vectors or complexity'));

    return true;
  }

  const halfWidth = ductParams[0] * 0.5,
    halfHeight = ductParams[1] * 0.5;
  if (
    tubeParams[2] <= kEps ||
    ductPosition[0] - halfWidth < -kEps ||
    ductPosition[0] + halfWidth > tubeParams[2] + kEps ||
    Math.abs(ductPosition[1]) + halfHeight > tubeParams[0] * 0.5 + kEps ||
    Math.abs(ductParams[2]) <= tubeParams[1] * 0.5 + kEps
  ) {
    scene.warnings.push(
      warningFor(
        call,
        'makeRectToTubeIntersection opening must lie within the main tube and ductLength must extend beyond diamB/2',
      ),
    );

    return true;
  }
  const [mainTube, duct] = buildRectTubeIntersectionMeshes(
    context,
    start.v,
    normal.v,
    upVector.v,
    tubeParams[0],
    tubeParams[1],
    tubeParams[2],
    ductPosition[0],
    ductPosition[1],
    ductParams[0],
    ductParams[1],
    ductParams[2],
    complexity.v,
  );
  pushNonEmptyMesh(scene, mainTube);
  pushNonEmptyMesh(scene, duct);

  return true;
}

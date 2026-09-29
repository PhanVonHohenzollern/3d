import { normalized } from '@engine/math/DVec3';
import type { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import { buildSectionTubeMesh } from '@engine/geometry/builders/circularMeshes';
import {
  buildRectTubeIntersectionMeshes,
  buildRectToEllipseTransitionMesh,
  rectangleCorners,
} from '@engine/geometry/builders/transitionMeshes';
import { namedAdapter } from '@engine/geometry/helpers/adapterErrors';
import { warningFor } from '@engine/geometry/helpers/apiCall';
import { kEps, sdkPerpVector, toPoint, toVec, validDirection } from '@engine/geometry/helpers/geometryMath';
import { pushNonEmptyMesh } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import type { AdapterTable } from '@engine/geometry/adapters/types';

// The tessellation a transition previews with when its complexity cannot be evaluated.
const kPreviewComplexity = 10;

// An unevaluated complexity does not fail the call: it warns and previews with kPreviewComplexity.
function transitionComplexity(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): number {
  try {
    return a.int('n');
  } catch {
    scene.warnings.push(
      warningFor(
        context.call,
        `makeRectToTubeTransition complexity is unresolved; using preview tessellation n=${kPreviewComplexity}`,
      ),
    );

    return kPreviewComplexity;
  }
}

// The overloads give the rectangle either as its corners[4] or as heightWidth[2] around start.
function transitionCorners(a: NamedArguments, start: FdPoint3d, normal: FdVector3d, up: FdVector3d): FdPoint3d[] {
  if (a.has('corners')) {
    const corners = a.pointArray('corners');
    if (corners.length < 4) throw new Error('makeRectToTubeTransition corners array must contain four points');

    return corners.slice(0, 4);
  }
  const heightWidth = a.realArray('heightWidth');
  if (heightWidth.length < 2 || heightWidth[0] <= 0.0 || heightWidth[1] <= 0.0)
    throw new Error('makeRectToTubeTransition requires corners[4] or positive heightWidth[2]');

  return rectangleCorners(start, normal, up, heightWidth[0], heightWidth[1]);
}

function appendRectToTubeTransition(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const start = a.point('start');
  const normal = a.fdVector('normal'),
    upVector = a.fdVector('upVector');
  const tubeStart = a.point('tubeStart');
  const tubeDiams = a.realArray('tubeDiams');
  const complexity = transitionComplexity(scene, context, a);
  if (
    !validDirection(normal) ||
    !validDirection(upVector) ||
    tubeDiams.length < 3 ||
    tubeDiams[0] <= 0.0 ||
    tubeDiams[1] <= 0.0 ||
    !tubeDiams.every(Number.isFinite) ||
    complexity < 1
  )
    throw new Error('makeRectToTubeTransition has invalid normal/upVector, tube diameters or tube length');
  const corners = transitionCorners(a, start, normal, upVector);

  const transition = buildRectToEllipseTransitionMesh(
    context,
    corners,
    start,
    normal,
    upVector,
    tubeStart,
    tubeDiams[0],
    tubeDiams[1],
    complexity,
  );
  transition.apiName += '.transition';
  if (transition.vertices.length === 0 || transition.indices.length === 0)
    throw new Error('makeRectToTubeTransition could not build the rectangle-to-ellipse loft');
  pushNonEmptyMesh(scene, transition);
  if (Math.abs(tubeDiams[2]) <= kEps) return;

  const n = normalized(toVec(normal));
  const tubeEnd = toPoint(toVec(tubeStart).add(n.mul(tubeDiams[2])));
  const centers = [tubeStart, tubeEnd];
  const normals = [normal, normal];
  const ups = [upVector, upVector];
  const diameters = [
    [tubeDiams[0], tubeDiams[1]],
    [tubeDiams[0], tubeDiams[1]],
  ];
  const tube = buildSectionTubeMesh(context, centers, normals, ups, diameters, complexity, 1, false);
  tube.apiName += '.tube';
  if (tube.vertices.length === 0 || tube.indices.length === 0)
    throw new Error('makeRectToTubeTransition could not build the elliptical tube');
  pushNonEmptyMesh(scene, tube);
}

// Without an upVector the section is oriented by the SDK's perpendicular to the normal.
function appendRectToTubeIntersection(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const start = a.point('start');
  const normal = a.fdVector('normal');
  const upVector = a.has('upVector') ? a.fdVector('upVector') : sdkPerpVector(normal);
  const tubeParams = a.realArray('tubeParams'),
    ductPosition = a.realArray('ductPosition'),
    ductParams = a.realArray('ductParams');
  const complexity = a.int('n');
  if (
    !validDirection(normal) ||
    !validDirection(upVector) ||
    tubeParams.length < 3 ||
    ductPosition.length < 2 ||
    ductParams.length < 3 ||
    tubeParams[0] <= 0.0 ||
    tubeParams[1] <= 0.0 ||
    Math.abs(tubeParams[2]) <= kEps ||
    ductParams[0] <= 0.0 ||
    ductParams[1] <= 0.0 ||
    Math.abs(ductParams[2]) <= kEps ||
    complexity < 1
  )
    throw new Error('makeRectToTubeIntersection has invalid dimensions, vectors or complexity');

  const halfWidth = ductParams[0] * 0.5,
    halfHeight = ductParams[1] * 0.5;
  if (
    tubeParams[2] <= kEps ||
    ductPosition[0] - halfWidth < -kEps ||
    ductPosition[0] + halfWidth > tubeParams[2] + kEps ||
    Math.abs(ductPosition[1]) + halfHeight > tubeParams[0] * 0.5 + kEps ||
    Math.abs(ductParams[2]) <= tubeParams[1] * 0.5 + kEps
  )
    throw new Error(
      'makeRectToTubeIntersection opening must lie within the main tube and ductLength must extend beyond diamB/2',
    );
  const [mainTube, duct] = buildRectTubeIntersectionMeshes(
    context,
    start,
    normal,
    upVector,
    tubeParams[0],
    tubeParams[1],
    tubeParams[2],
    ductPosition[0],
    ductPosition[1],
    ductParams[0],
    ductParams[1],
    ductParams[2],
    complexity,
  );
  pushNonEmptyMesh(scene, mainTube);
  pushNonEmptyMesh(scene, duct);
}

export const rectToTubeAdapters: AdapterTable = {
  makeRectToTubeTransition: namedAdapter('invalid makeRectToTubeTransition arguments', appendRectToTubeTransition),
  makeRectToTubeIntersection: namedAdapter(
    'invalid makeRectToTubeIntersection arguments',
    appendRectToTubeIntersection,
  ),
};

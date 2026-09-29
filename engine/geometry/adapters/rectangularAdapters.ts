import { llroundToInt, type FdPoint3d } from '@engine/runtime';
import { length, normalized } from '@engine/math';
import { buildFacettedCylinderMesh } from '@engine/geometry/builders/circularMeshes';
import {
  buildConnectorFlangeMesh,
  buildPolygonFaceMesh,
  buildRectFaceMesh,
} from '@engine/geometry/builders/rectangularMeshes';
import { namedAdapter } from '@engine/geometry/helpers/adapterErrors';
import { kEps, sdkPerpVector, toPoint, toVec, validDirection } from '@engine/geometry/helpers/geometryMath';
import { pushNonEmptyMesh } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene, PreviewMesh } from '@engine/geometry/previewScene';
import type { AdapterTable } from '@engine/geometry/adapters/types';

// The frame width a connector gets unless the call supplies a positive connectorWidth.
const kDefaultConnectorWidth = 30.0;

function appendFacettedCylinder(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const start = a.point('startPoint'),
    end = a.point('endPointD');
  const up = a.fdVector('upVectorD');
  const diameter = a.real('diam'),
    startAngle = a.real('startAngle'),
    endAngle = a.real('endAngle');
  const complexity = llroundToInt(a.real('i'));
  const front = a.flag('front'),
    back = a.flag('back');
  if (diameter <= 0.0 || complexity < 1 || length(toVec(end).sub(toVec(start))) <= kEps)
    throw new Error('invalid facetted-cylinder dimensions');
  scene.meshes.push(
    buildFacettedCylinderMesh(context, start, end, up, diameter, startAngle, endAngle, complexity, front, back),
  );
}

// makeScrew2's SW is the wrench size across the hexagon's flats; it is widened to the corner diameter.
function appendScrew(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  a: NamedArguments,
  hexAcrossCorners: boolean,
): void {
  const start = a.point('cp');
  const direction = a.fdVector('vector'),
    up = a.fdVector('upVector');
  let diameter = a.real(hexAcrossCorners ? 'SW' : 'd1');
  const screwLength = a.real('length');
  const back = a.flag('back'),
    front = a.flag('front');
  if (!validDirection(direction) || diameter <= 0.0 || Math.abs(screwLength) <= kEps)
    throw new Error('invalid screw dimensions/vector');
  if (hexAcrossCorners) diameter /= Math.cos(Math.PI / 6);
  const dir = normalized(toVec(direction));
  const end = toPoint(toVec(start).add(dir.mul(screwLength)));
  scene.meshes.push(buildFacettedCylinderMesh(context, start, end, up, diameter, 0.0, 360.0, 6, front, back));
}

function appendRectFace(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const center = a.point('center');
  const normal = a.fdVector('normal'),
    up = a.fdVector('upVect');
  const height = a.real('height'),
    width = a.real('width');
  if (!validDirection(normal) || !validDirection(up) || height <= 0.0 || width <= 0.0)
    throw new Error('invalid rect-face dimensions/vectors');
  scene.meshes.push(buildRectFaceMesh(context, center, normal, up, height, width));
}

function appendPlane(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  pushNonEmptyMesh(scene, planeMesh(context, a));
}

// The overloads: a points[4] array, four corner points p1..p4, or a centred H x L rectangle.
function planeMesh(context: MeshBuildContext, a: NamedArguments): PreviewMesh {
  if (a.has('points')) {
    const points = a.pointArray('points');
    if (points.length < 4) throw new Error('points must contain four FdPoint3d');

    return buildPolygonFaceMesh(context, points.slice(0, 4));
  }
  if (a.has('p1')) {
    const corners: FdPoint3d[] = ['p1', 'p2', 'p3', 'p4'].map((name) => a.point(name));

    return buildPolygonFaceMesh(context, corners);
  }
  const center = a.point('cp');
  const normal = a.fdVector('normal'),
    up = a.fdVector('upVector');
  const height = a.real('H'),
    planeLength = a.real('L');
  if (!validDirection(normal) || !validDirection(up) || height <= 0.0 || planeLength <= 0.0)
    throw new Error('invalid plane dimensions/vectors');

  return buildRectFaceMesh(context, center, normal, up, height, planeLength);
}

// connectorWidth only replaces the default frame width when it is a positive number; any other
// value previews with the default rather than failing the call.
function connectorFrameWidth(a: NamedArguments): number {
  const width = a.optionalReal('connectorWidth', kDefaultConnectorWidth);

  return width > 0.0 ? width : kDefaultConnectorWidth;
}

// Without an upVector the connector is oriented by the SDK's perpendicular to its normal.
function appendConnector(scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments): void {
  const center = a.point('centralPoint');
  const normal = a.fdVector('vector');
  const withUpVector = a.has('upVector');
  const up = withUpVector ? a.fdVector('upVector') : sdkPerpVector(normal);
  const width = a.real('width'),
    height = a.real('height');
  const frameWidth = withUpVector ? connectorFrameWidth(a) : kDefaultConnectorWidth;
  if (!validDirection(normal) || !validDirection(up) || width <= 0.0 || height <= 0.0)
    throw new Error('invalid connector dimensions/vectors');

  const connector = buildConnectorFlangeMesh(context, center, normal, up, width, height, frameWidth, 0, 1.0);
  pushNonEmptyMesh(scene, connector);
}

export const rectangularPrimitiveAdapters: AdapterTable = {
  makeFacettedCylinder: namedAdapter('invalid facetted-cylinder arguments', appendFacettedCylinder),
  makeRectFace: namedAdapter('invalid rect-face arguments', appendRectFace),
  makeScrew: namedAdapter('invalid screw arguments', (scene, context, a) => appendScrew(scene, context, a, false)),
  makeScrew2: namedAdapter('invalid screw arguments', (scene, context, a) => appendScrew(scene, context, a, true)),
};

export const rectangularCompositeAdapters: AdapterTable = {
  makePlane: namedAdapter('invalid plane arguments', appendPlane),
  makeConnector: namedAdapter('invalid connector arguments', appendConnector),
};

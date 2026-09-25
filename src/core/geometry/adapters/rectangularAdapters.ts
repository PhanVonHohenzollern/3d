import { llroundToInt } from '../../../utils/cppStd';
import { length, normalized } from '../../../utils/DVec3';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildFacettedCylinderMesh } from '../builders/circularMeshes';
import { buildConnectorFlangeMesh, buildPolygonFaceMesh, buildRectFaceMesh } from '../builders/rectangularMeshes';
import { warningFor } from '../helpers/apiCall';
import { kEps, sdkPerpVector, toPoint, toVec, validDirection } from '../helpers/geometryMath';
import { pushNonEmptyMesh } from '../helpers/meshData';
import { asBool, asNumber, asPoint, asVector, pointArray, ref } from '../helpers/valueDecoding';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

export function appendFacettedCylinder(
  scene: PreviewGeometryScene,
  context: MeshBuildContext,
  args: RuntimeValue[],
): boolean {
  if (args.length !== 9) return false;
  const call = context.call;
  const start = ref(new FdPoint3d()),
    end = ref(new FdPoint3d());
  const up = ref(new FdVector3d());
  const diameter = ref(0.0),
    startAngle = ref(0.0),
    endAngle = ref(0.0),
    complexityD = ref(0.0);
  const front = ref(false),
    back = ref(false);
  if (
    !asPoint(args[0], start) ||
    !asPoint(args[1], end) ||
    !asVector(args[2], up) ||
    !asNumber(args[3], diameter) ||
    !asNumber(args[4], startAngle) ||
    !asNumber(args[5], endAngle) ||
    !asNumber(args[6], complexityD) ||
    !asBool(args[7], front) ||
    !asBool(args[8], back)
  ) {
    scene.warnings.push(warningFor(call, 'invalid facetted-cylinder arguments'));

    return true;
  }
  const complexity = llroundToInt(complexityD.v);
  if (diameter.v <= 0.0 || complexity < 1 || length(toVec(end.v).sub(toVec(start.v))) <= kEps) {
    scene.warnings.push(warningFor(call, 'invalid facetted-cylinder dimensions'));

    return true;
  }
  scene.meshes.push(
    buildFacettedCylinderMesh(
      context,
      start.v,
      end.v,
      up.v,
      diameter.v,
      startAngle.v,
      endAngle.v,
      complexity,
      front.v,
      back.v,
    ),
  );

  return true;
}

export function appendScrew(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  if (args.length !== 6 && args.length !== 7) return false;
  const call = context.call;
  const start = ref(new FdPoint3d());
  const direction = ref(new FdVector3d()),
    up = ref(new FdVector3d());
  const diameter = ref(0.0),
    screwLength = ref(0.0);
  const back = ref(false),
    front = ref(true);
  if (
    !asPoint(args[0], start) ||
    !asVector(args[1], direction) ||
    !asVector(args[2], up) ||
    !asNumber(args[3], diameter) ||
    !asNumber(args[4], screwLength) ||
    !asBool(args[5], back) ||
    (args.length === 7 && !asBool(args[6], front))
  ) {
    scene.warnings.push(warningFor(call, 'invalid screw arguments'));

    return true;
  }
  if (!validDirection(direction.v) || diameter.v <= 0.0 || Math.abs(screwLength.v) <= kEps) {
    scene.warnings.push(warningFor(call, 'invalid screw dimensions/vector'));

    return true;
  }
  if (context.call.name === 'makeScrew2') diameter.v /= Math.cos(Math.PI / 6);
  const dir = normalized(toVec(direction.v));
  const end = toPoint(toVec(start.v).add(dir.mul(screwLength.v)));
  scene.meshes.push(buildFacettedCylinderMesh(context, start.v, end, up.v, diameter.v, 0.0, 360.0, 6, front.v, back.v));

  return true;
}

export function appendRectFace(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  if (args.length !== 5) return false;
  const call = context.call;
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d()),
    up = ref(new FdVector3d());
  const height = ref(0.0),
    width = ref(0.0);
  if (
    !asPoint(args[0], center) ||
    !asVector(args[1], normal) ||
    !asVector(args[2], up) ||
    !asNumber(args[3], height) ||
    !asNumber(args[4], width)
  ) {
    scene.warnings.push(warningFor(call, 'invalid rect-face arguments'));

    return true;
  }
  if (!validDirection(normal.v) || !validDirection(up.v) || height.v <= 0.0 || width.v <= 0.0) {
    scene.warnings.push(warningFor(call, 'invalid rect-face dimensions/vectors'));

    return true;
  }
  scene.meshes.push(buildRectFaceMesh(context, center.v, normal.v, up.v, height.v, width.v));

  return true;
}

export function appendPlane(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  const planePoints: FdPoint3d[] = [];
  if (args.length !== 0 && pointArray(args[0], planePoints) && planePoints.length >= 4) {
    pushNonEmptyMesh(scene, buildPolygonFaceMesh(context, planePoints.slice(0, 4)));

    return true;
  }
  if (args.length >= 4) {
    const p1 = ref(new FdPoint3d()),
      p2 = ref(new FdPoint3d()),
      p3 = ref(new FdPoint3d()),
      p4 = ref(new FdPoint3d());
    if (asPoint(args[0], p1) && asPoint(args[1], p2) && asPoint(args[2], p3) && asPoint(args[3], p4)) {
      pushNonEmptyMesh(scene, buildPolygonFaceMesh(context, [p1.v, p2.v, p3.v, p4.v]));

      return true;
    }
  }
  if (args.length >= 5) {
    const cp = ref(new FdPoint3d());
    const normal = ref(new FdVector3d()),
      up = ref(new FdVector3d());
    const h = ref(0.0),
      l = ref(0.0);
    if (
      asPoint(args[0], cp) &&
      asVector(args[1], normal) &&
      asVector(args[2], up) &&
      asNumber(args[3], h) &&
      asNumber(args[4], l) &&
      validDirection(normal.v) &&
      validDirection(up.v) &&
      h.v > 0.0 &&
      l.v > 0.0
    ) {
      pushNonEmptyMesh(scene, buildRectFaceMesh(context, cp.v, normal.v, up.v, h.v, l.v));

      return true;
    }
  }

  return false;
}

export function appendConnector(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  const center = ref(new FdPoint3d());
  const normal = ref(new FdVector3d());
  if (args.length < 4 || !asPoint(args[0], center) || !asVector(args[1], normal)) return false;

  const up = ref(new FdVector3d());
  const width = ref(0.0),
    height = ref(0.0);
  let frameWidth = 30.0;
  if (args.length >= 5 && asVector(args[2], up)) {
    if (!asNumber(args[3], width) || !asNumber(args[4], height)) return false;
    if (args.length >= 6) {
      const supplied = ref(0.0);
      if (asNumber(args[5], supplied) && supplied.v > 0.0) frameWidth = supplied.v;
    }
  } else {
    if (!asNumber(args[2], width) || !asNumber(args[3], height)) return false;
    up.v = sdkPerpVector(normal.v);
  }
  if (!validDirection(normal.v) || !validDirection(up.v) || width.v <= 0.0 || height.v <= 0.0) return false;

  const connector = buildConnectorFlangeMesh(context, center.v, normal.v, up.v, width.v, height.v, frameWidth, 0, 1.0);
  pushNonEmptyMesh(scene, connector);

  return true;
}

import type { DebugKind } from '../../types/viewportEngine';
import { distancePointToSegment, rayTriangleDistance } from '../../utils/geometry';
import { isValidIndex } from '../../utils/math';
import { QPointF, QVector3D } from '../../utils/Vector3D';
import type { ConnectorPreview } from '../geometry/ConnectorPreview';
import type { PreviewMesh } from '../geometry/PreviewGeometryEngine';
import type { DebugItem } from './DebugItem';
import type { VertexArray } from './VertexArray';
import type { ScreenRay } from './ViewportCamera';

type Projection = (world: QVector3D) => QPointF | null;

const kPointPickRadius = 18;
const kVectorPickRadius = 12;
const kConnectorPickRadius = 18;

export function pickMeshAlongRay(
  meshes: readonly PreviewMesh[],
  ray: ScreenRay,
  isApiVisible: (apiIndex: number) => boolean,
): number {
  return pickMeshesAlongRay(meshes, ray, isApiVisible)[0] ?? -1;
}

export function pickMeshesAlongRay(
  meshes: readonly PreviewMesh[],
  ray: ScreenRay,
  isApiVisible: (apiIndex: number) => boolean,
): number[] {
  const nearPoint = ray.nearPoint;
  const direction = ray.farPoint.sub(nearPoint).normalized();
  const hits: { index: number; distance: number }[] = [];
  for (let meshIndex = 0; meshIndex < meshes.length; ++meshIndex) {
    const mesh = meshes[meshIndex];
    if (!isApiVisible(mesh.apiIndex)) continue;
    let closest = ray.farPoint.sub(nearPoint).length();
    let hit = false;
    const vertexCount = mesh.vertices.length;
    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const ia = mesh.indices[i];
      const ib = mesh.indices[i + 1];
      const ic = mesh.indices[i + 2];
      if (!isValidIndex(ia, vertexCount) || !isValidIndex(ib, vertexCount) || !isValidIndex(ic, vertexCount)) continue;
      const distance = rayTriangleDistance(
        nearPoint,
        direction,
        mesh.vertices[ia],
        mesh.vertices[ib],
        mesh.vertices[ic],
      );
      if (Number.isFinite(distance) && distance >= 0 && distance < closest) {
        closest = distance;
        hit = true;
      }
    }
    if (hit) hits.push({ index: meshIndex, distance: closest });
  }

  return hits.sort((a, b) => a.distance - b.distance).map((hit) => hit.index);
}

export function pickDebugItemAt(
  items: readonly DebugItem[],
  kind: DebugKind,
  screen: QPointF,
  eye: QVector3D,
  isVisible: (item: DebugItem) => boolean,
  project: Projection,
  vectorArrow: (item: DebugItem) => VertexArray,
): string {
  return pickDebugItemsAt(items, kind, screen, eye, isVisible, project, vectorArrow)[0] ?? '';
}

export function pickDebugItemsAt(
  items: readonly DebugItem[],
  kind: DebugKind,
  screen: QPointF,
  eye: QVector3D,
  isVisible: (item: DebugItem) => boolean,
  project: Projection,
  vectorArrow: (item: DebugItem) => VertexArray,
): string[] {
  const hits: { name: string; distance: number; depth: number }[] = [];
  const radius = kind === 'Point' ? kPointPickRadius : kVectorPickRadius;

  for (const item of items) {
    if (item.kind !== kind || !isVisible(item)) continue;
    let distance = radius;

    if (kind === 'Point') {
      const p = project(item.end);
      if (!p) continue;
      const d = screen.sub(p);
      distance = Math.sqrt(d.x * d.x + d.y * d.y);
    } else {
      const arrow = vectorArrow(item);
      for (let i = 0; i + 1 < arrow.size(); i += 2) {
        const a = project(arrow.position(i));
        const b = a ? project(arrow.position(i + 1)) : null;
        if (a && b) distance = Math.min(distance, distancePointToSegment(screen, a, b));
      }
    }
    if (distance >= radius) continue;
    const depth = item.end.sub(eye).lengthSquared();
    hits.push({ name: item.name, distance, depth });
  }

  return hits
    .sort((a, b) => (Math.abs(a.distance - b.distance) <= 0.01 ? a.depth - b.depth : a.distance - b.distance))
    .map((hit) => hit.name);
}

export function pickConnectorAt(connectors: readonly ConnectorPreview[], screen: QPointF, project: Projection): number {
  let best = kConnectorPickRadius * kConnectorPickRadius;
  let result = -1;
  for (const connector of connectors) {
    const point = project(new QVector3D(connector.point.x, connector.point.y, connector.point.z));
    if (!point) continue;
    const delta = screen.sub(point);
    const distance = QPointF.dotProduct(delta, delta);
    if (distance < best) {
      best = distance;
      result = connector.id;
    }
  }

  return result;
}

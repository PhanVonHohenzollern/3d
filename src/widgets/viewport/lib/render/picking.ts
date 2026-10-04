import type { DebugKind } from '@/widgets/viewport/lib/render/types';
import { distancePointToSegment, rayTriangleDistance } from '@/widgets/viewport/lib/math/geometry';
import { clamp, isValidIndex } from '@/widgets/viewport/lib/math/math';
import { QPointF, QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { ConnectorPreview } from '@engine/geometry';
import type { PreviewMesh } from '@engine/geometry';
import type { DebugItem } from '@/widgets/viewport/lib/render/DebugItem';
import type { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';
import type { ScreenRay } from '@/widgets/viewport/lib/render/ViewportCamera';

type Projection = (world: QVector3D) => QPointF | null;
type LinePick = { screen: QPointF; project: Projection };

const kPointPickRadius = 18;
const kVectorPickRadius = 12;
const kConnectorPickRadius = 18;
const kLinePickRadius = 6;

export function pickMeshAlongRay(
  meshes: readonly PreviewMesh[],
  ray: ScreenRay,
  isApiVisible: (apiIndex: number) => boolean,
  linePick?: LinePick,
): number {
  return pickMeshesAlongRay(meshes, ray, isApiVisible, linePick)[0] ?? -1;
}

export function pickMeshesAlongRay(
  meshes: readonly PreviewMesh[],
  ray: ScreenRay,
  isApiVisible: (apiIndex: number) => boolean,
  linePick?: LinePick,
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
    if (mesh.primitive === 'lines') {
      if (!linePick) continue;
      for (let i = 0; i + 1 < mesh.indices.length; i += 2) {
        const ia = mesh.indices[i],
          ib = mesh.indices[i + 1];
        if (!isValidIndex(ia, vertexCount) || !isValidIndex(ib, vertexCount)) continue;
        const a = mesh.vertices[ia],
          b = mesh.vertices[ib];
        const start = new QVector3D(a.x, a.y, a.z);
        const edge = new QVector3D(b.x - a.x, b.y - a.y, b.z - a.z);
        const across = edge.sub(direction.mul(QVector3D.dotProduct(edge, direction)));
        const t =
          across.lengthSquared() > 1e-12
            ? clamp(-QVector3D.dotProduct(start.sub(nearPoint), across) / across.lengthSquared(), 0, 1)
            : Number(QVector3D.dotProduct(edge, direction) < 0);
        const point = start.add(edge.mul(t));
        const screen = linePick.project(point);
        if (!screen || Math.hypot(screen.x - linePick.screen.x, screen.y - linePick.screen.y) >= kLinePickRadius)
          continue;
        const distance = QVector3D.dotProduct(point.sub(nearPoint), direction);
        if (distance >= 0 && distance < closest) {
          closest = distance;
          hit = true;
        }
      }
      if (hit) hits.push({ index: meshIndex, distance: closest });
      continue;
    }
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

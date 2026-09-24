import { debugValueText } from '../../helpers/debugValueText';
import type { TextMeasurer } from '../../types/text';
import type { ConnectorVertexRanges } from '../../types/viewportEngine';
import { Qt, qColor, qPen } from '../../utils/painting';
import { QRectF } from '../../utils/Rect';
import { fontHeight, horizontalAdvance } from '../../utils/textMetrics';
import { QVector3D, type QPointF } from '../../utils/Vector3D';
import type { ConnectorPreview } from '../geometry/ConnectorPreview';
import type { FdPoint3d } from '../runtime/FdMath';
import type { OverlayPainter } from './OverlayPainter';
import type { VertexArray } from './VertexArray';

const toVector = (p: { x: number; y: number; z: number }) => new QVector3D(p.x, p.y, p.z);

export function connectorTip(connector: ConnectorPreview): FdPoint3d {
  return connector.point.add(connector.direction.mul(connector.length * 1.65));
}

export function connectorSceneScale(connectors: readonly ConnectorPreview[]): number {
  let scale = 0;
  for (const connector of connectors) {
    for (const mesh of connector.meshes)
      for (const v of mesh.vertices) scale = Math.max(scale, Math.hypot(v.x, v.y, v.z));
    const tip = connectorTip(connector);
    scale = Math.max(scale, Math.hypot(tip.x, tip.y, tip.z));
  }

  return scale;
}

export function appendConnectorVertices(
  vertices: VertexArray,
  connectors: readonly ConnectorPreview[],
  selectedId: number,
): ConnectorVertexRanges {
  const vertexStart = vertices.size();
  for (const connector of connectors) {
    const selected = connector.id === selectedId;
    const color = selected ? new QVector3D(0.35, 0.85, 1.0) : new QVector3D(0.18, 0.5, 0.6);
    for (const mesh of connector.meshes) {
      for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
        const a = mesh.vertices[mesh.indices[i]];
        const b = mesh.vertices[mesh.indices[i + 1]];
        const c = mesh.vertices[mesh.indices[i + 2]];
        if (!a || !b || !c) continue;
        const normal = QVector3D.crossProduct(
          new QVector3D(b.x - a.x, b.y - a.y, b.z - a.z),
          new QVector3D(c.x - a.x, c.y - a.y, c.z - a.z),
        ).normalized();
        for (const v of [a, b, c])
          vertices.push(v.x, v.y, v.z, color.x, color.y, color.z, normal.x, normal.y, normal.z);
      }
    }
  }
  const vertexCount = vertices.size() - vertexStart;
  const lineStart = vertices.size();
  for (const connector of connectors) {
    const color = connector.id === selectedId ? new QVector3D(1.0, 0.96, 0.45) : new QVector3D(0.35, 0.7, 0.8);

    const line = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
      vertices.appendLine(toVector(a), toVector(b), color.x, color.y, color.z);

    for (const [a, b] of connector.outline) line(a, b);
    const tip = connectorTip(connector);
    const base = tip.sub(connector.direction.mul(connector.length * 0.22));
    line(connector.point, tip);
    for (const side of [connector.up, connector.direction.crossProduct(connector.up)]) {
      line(tip, base.add(side.mul(connector.length * 0.12)));
      line(tip, base.sub(side.mul(connector.length * 0.12)));
    }
  }

  return { vertexStart, vertexCount, lineStart, lineCount: vertices.size() - lineStart };
}

export function drawConnectorPoints(
  painter: OverlayPainter,
  connectors: readonly ConnectorPreview[],
  selectedId: number,
  hoveredId: number,
  measurer: TextMeasurer,
  project: (world: QVector3D) => QPointF | null,
): void {
  painter.save();
  for (const connector of connectors) {
    const screen = project(toVector(connector.point));
    if (!screen) continue;
    const selected = connector.id === selectedId;
    const hovered = connector.id === hoveredId;
    painter.setPen(qPen(hovered ? Qt.white : qColor(18, 30, 35), 2));
    painter.setBrush(selected ? qColor(255, 243, 105) : qColor(70, 205, 230));
    const radius = hovered ? 9 : selected ? 7 : 5;
    painter.drawEllipse(screen, radius, radius);
    if (!selected) continue;
    const label = `${connector.pointName} ${debugValueText(connector.point)}`;
    const font = painter.font();
    const width = horizontalAdvance(measurer, label, font) + 12;
    const height = fontHeight(measurer, font) + 6;
    const area = new QRectF(screen.x + 12, screen.y + 8, width, height);
    painter.setPen(null);
    painter.setBrush(qColor(25, 35, 42, 235));
    painter.drawRoundedRect(area, 3, 3);
    painter.setPen(qColor(255, 243, 165));
    painter.drawTextCentered(area, label);
  }
  painter.restore();
}

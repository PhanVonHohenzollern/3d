import type { FontSpec, TextMeasurer } from '../../types/text';
import type { AxisLabel } from '../../types/viewportEngine';
import type { QMatrix4x4 } from '../../utils/Matrix4x4';
import { qColor } from '../../utils/painting';
import { QRectF } from '../../utils/Rect';
import { fontHeightF } from '../../utils/textMetrics';
import { QPointF, QVector3D, QVector4D } from '../../utils/Vector3D';
import { connectorOrientations, previewOrientationDirection } from '../geometry/ConnectorPreview';
import type { OverlayPainter } from './OverlayPainter';
import { VertexArray } from './VertexArray';

export interface WorldAxisLabelInput {
  axes: VertexArray;
  transform: QMatrix4x4;
  width: number;
  height: number;
  occupied: QRectF[];
  measurer: TextMeasurer;
  font: FontSpec;
}

const kAxisColors = [new QVector3D(0.95, 0.2, 0.2), new QVector3D(0.2, 0.9, 0.3), new QVector3D(0.25, 0.45, 1.0)];
const kLabelColors = [qColor(242, 70, 70), qColor(65, 230, 90), qColor(95, 145, 255)];

export function axesVertices(sceneScale: number, target: QVector3D, distance: number): VertexArray {
  const vertices = new VertexArray();
  const extent = Math.max(10, sceneScale * 1.45, target.length() + distance * 2);
  for (let axis = 0; axis < 3; ++axis) {
    const positive = previewOrientationDirection(connectorOrientations[axis * 2]);
    const end = new QVector3D(positive.x * extent, positive.y * extent, positive.z * extent);
    const color = kAxisColors[axis];
    vertices.appendLine(end.neg(), end, color.x, color.y, color.z);
  }
  return vertices;
}

export function placeWorldAxisLabels(input: WorldAxisLabelInput): AxisLabel[] {
  const { axes, transform, width, height, measurer, font } = input;
  const labels: AxisLabel[] = [];
  if (width < 80 || height < 80 || axes.size() !== 6) return labels;
  const screen = new QRectF(0, 0, width, height);
  const inset = screen.adjusted(22, 22, -22, -22);
  const occupied = [...input.occupied];
  const range = { lo: 0, hi: 1 };
  const clip = (start: number, end: number): boolean => {
    if (start < 0 && end < 0) return false;
    if (start < 0) range.lo = Math.max(range.lo, start / (start - end));
    else if (end < 0) range.hi = Math.min(range.hi, start / (start - end));
    return range.lo <= range.hi;
  };
  const project = (p: QVector4D) => new QPointF((p.x / p.w + 1) * width * 0.5, (1 - p.y / p.w) * height * 0.5);
  const atEdge = (p: QPointF) =>
    Math.min(Math.abs(p.x), Math.abs(p.x - width), Math.abs(p.y), Math.abs(p.y - height)) < 2;
  for (let axis = 0; axis < 3; ++axis) {
    const a = transform.map(QVector4D.fromVector3D(axes.position(axis * 2), 1));
    const b = transform.map(QVector4D.fromVector3D(axes.position(axis * 2 + 1), 1));
    range.lo = 0;
    range.hi = 1;
    let visible = true;
    for (let component = 0; component < 3 && visible; ++component) {
      visible =
        clip(a.w + a.at(component), b.w + b.at(component)) && clip(a.w - a.at(component), b.w - b.at(component));
    }
    if (!visible) continue;
    const ca = a.add(b.sub(a).mul(range.lo));
    const cb = a.add(b.sub(a).mul(range.hi));
    if (ca.w <= 1e-6 || cb.w <= 1e-6) continue;
    const pa = project(ca);
    const pb = project(cb);
    range.lo = 0;
    range.hi = 1;
    if (
      !clip(pa.x - inset.left(), pb.x - inset.left()) ||
      !clip(inset.right() - pa.x, inset.right() - pb.x) ||
      !clip(pa.y - inset.top(), pb.y - inset.top()) ||
      !clip(inset.bottom() - pa.y, inset.bottom() - pb.y)
    )
      continue;
    const ends = [pa.add(pb.sub(pa).mul(range.lo)), pa.add(pb.sub(pa).mul(range.hi))];
    for (let end = 0; end < 2; ++end) {
      if (!atEdge(end === 0 ? pa : pb)) continue;
      const delta = ends[1 - end].sub(ends[end]);
      const length = Math.hypot(delta.x, delta.y);
      if (length < 25) continue;
      const inward = delta.div(length);
      const text = `${'XYZ'[axis]}${end === 0 ? '-' : '+'}`;
      const sizeWidth = measurer.horizontalAdvance(text, font) + 8;
      const sizeHeight = fontHeightF(measurer, font) + 4;
      for (let offset = 0; offset < length * 0.45; offset += 8) {
        const anchor = ends[end].add(inward.mul(offset));
        const bounds = new QRectF(anchor.x - sizeWidth / 2, anchor.y - sizeHeight / 2, sizeWidth, sizeHeight);
        if (!screen.contains(bounds)) continue;
        if (occupied.some((area) => area.intersects(bounds))) continue;
        labels.push({ text, color: kLabelColors[axis], anchor, bounds });
        occupied.push(bounds.adjusted(-3, -3, 3, 3));
        break;
      }
    }
  }
  return labels;
}

export function drawWorldAxisLabels(painter: OverlayPainter, labels: readonly AxisLabel[], font: FontSpec): void {
  painter.save();
  painter.setFont(font);
  for (const label of labels) {
    painter.setPen(null);
    painter.setBrush(qColor(18, 19, 20, 220));
    painter.drawRoundedRect(label.bounds, 3, 3);
    painter.setPen(label.color);
    painter.drawTextCentered(label.bounds, label.text);
  }
  painter.restore();
}

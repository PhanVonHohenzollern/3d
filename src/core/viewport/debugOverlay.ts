import { Qt, qColor, qPen } from '../../utils/painting';
import type { QRect } from '../../utils/Rect';
import { QPointF, type QVector3D } from '../../utils/Vector3D';
import type { DebugItem } from './DebugItem';
import { kOverviewPointName } from './debugItems';
import type { OverlayPainter } from './OverlayPainter';
import type { VertexArray } from './VertexArray';

export interface DebugOverlayScene {
  items: readonly DebugItem[];
  selected: ReadonlySet<string>;
  hovered: string;
  showLabels: boolean;
  isVisible(item: DebugItem): boolean;
  project(world: QVector3D): QPointF | null;
  selectedRowRect(item: DebugItem): QRect;
  vectorArrow(item: DebugItem): VertexArray;
}

export function drawDebugItems(painter: OverlayPainter, scene: DebugOverlayScene): void {
  const drawnPointMarkers: QPointF[] = [];
  const drawnLeaders = new Set<string>();

  const pointMarkerAlreadyDrawn = (anchor: QPointF) => {
    for (const used of drawnPointMarkers) {
      const d = anchor.sub(used);
      if (d.x * d.x + d.y * d.y <= 9.0) return true;
    }
    drawnPointMarkers.push(anchor);

    return false;
  };

  for (const item of scene.items) {
    if (!scene.isVisible(item)) continue;

    let screen = scene.project(item.end);
    if (!screen) continue;
    const selected = scene.selected.has(item.name);

    if (item.kind === 'Point' && !pointMarkerAlreadyDrawn(screen)) {
      const fill = selected ? qColor(255, 245, 110) : qColor(255, 174, 52);
      const edge = selected ? qColor(255, 255, 255) : qColor(35, 35, 35);
      const radius = selected ? 7.5 : item.name === kOverviewPointName ? 4.5 : 3.2;
      painter.setPen(qPen(edge, selected ? 2.0 : 1.0));
      painter.setBrush(fill);
      painter.drawEllipse(screen, radius, radius);
    } else if (item.kind === 'Point' && selected) {
      painter.setPen(qPen(qColor(255, 255, 255), 2.0));
      painter.setBrush(null);
      painter.drawEllipse(screen, 8.5, 8.5);
    }

    if (scene.showLabels && selected && !drawnLeaders.has(item.name)) {
      const row = scene.selectedRowRect(item);
      if (!row.isEmpty()) {
        if (item.kind === 'Vector')
          screen = scene.project(item.start.add(item.end.sub(item.start).mul(0.55))) ?? screen;
        const attach = new QPointF(item.kind === 'Point' ? row.right() : row.left(), row.center().y);
        painter.setPen(qPen(qColor(255, 225, 110, 190), 1.2));
        painter.drawLine(screen, attach);
        drawnLeaders.add(item.name);
      }
    }
  }
}

export function drawPreselection(painter: OverlayPainter, scene: DebugOverlayScene): void {
  for (const item of scene.items) {
    if (item.name !== scene.hovered || !scene.isVisible(item)) continue;
    if (item.kind === 'Point') {
      const screen = scene.project(item.end);
      if (!screen) continue;
      painter.setPen(qPen(qColor(95, 220, 255), 2.5));
      painter.setBrush(null);
      painter.drawEllipse(screen, 11.0, 11.0);
      painter.setPen(qPen(Qt.white, 1.5));
      painter.setBrush(scene.selected.has(item.name) ? qColor(255, 245, 110) : qColor(95, 220, 255));
      painter.drawEllipse(screen, 5.0, 5.0);
    } else {
      const arrow = scene.vectorArrow(item);
      for (let pass = 0; pass < 2; ++pass) {
        painter.setPen(
          qPen(pass === 0 ? qColor(15, 25, 35, 210) : qColor(125, 235, 255), pass === 0 ? 6.0 : 3.0, 'RoundCap'),
        );
        for (let i = 0; i + 1 < arrow.size(); i += 2) {
          const a = scene.project(arrow.position(i));
          const b = a ? scene.project(arrow.position(i + 1)) : null;
          if (a && b) painter.drawLine(a, b);
        }
      }
    }
  }
}

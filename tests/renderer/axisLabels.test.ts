import { describe, expect, it } from 'vitest';
import { connectorOrientations, previewOrientationDirection } from '../../src/core/geometry/ConnectorPreview';
import type { ViewportEngine } from '../../src/core/viewport/ViewportEngine';
import { axesVertices, placeWorldAxisLabels } from '../../src/core/viewport/worldAxes';
import type { AxisLabel } from '../../src/types/viewportEngine';
import { QRectF } from '../../src/utils/Rect';
import { fontWithPointSize, kDefaultFontFamily } from '../../src/utils/textMetrics';
import { QPointF, QVector3D, QVector4D } from '../../src/utils/Vector3D';
import { createEngine, fixedMeasurer, resultWithP0, updateCamera } from './helpers';

function occupiedAreas(engine: ViewportEngine): QRectF[] {
  const areas = [engine.pointLabelPanel(), engine.vectorLabelPanel()]
    .filter((panel) => panel.isVisible())
    .map((panel) => QRectF.fromRect(panel.geometry()).adjusted(-4, -4, 4, 4));
  areas.push(QRectF.fromRect(engine.selectionModeButton().geometry).adjusted(-4, -4, 4, 4));

  return areas;
}

function labelsOf(engine: ViewportEngine): AxisLabel[] {
  const camera = updateCamera(engine);

  return placeWorldAxisLabels({
    axes: axesVertices(engine.sceneScale(), camera.target, camera.distance),
    transform: camera.viewProjection(),
    width: engine.width(),
    height: engine.height(),
    occupied: occupiedAreas(engine),
    measurer: fixedMeasurer,
    font: fontWithPointSize(kDefaultFontFamily, 9, true),
  });
}

function distanceToProjectedLine(engine: ViewportEngine, p: QPointF, a: QVector3D, b: QVector3D): number {
  const transform = updateCamera(engine).viewProjection();

  const toScreen = (v: QVector3D) => {
    const c = transform.map(QVector4D.fromVector3D(v, 1));

    return new QPointF((c.x / c.w + 1) * engine.width() * 0.5, (1 - c.y / c.w) * engine.height() * 0.5);
  };

  const pa = toScreen(a);
  const pb = toScreen(b);
  const d = pb.sub(pa);

  return Math.abs(d.x * (p.y - pa.y) - d.y * (p.x - pa.x)) / Math.hypot(d.x, d.y);
}

const axisDirection = (axis: number) => {
  const v = previewOrientationDirection(connectorOrientations[axis * 2]);

  return new QVector3D(v.x, v.y, v.z);
};

describe('world axis labels', () => {
  it('places labels on the projected axes, inside the viewport', () => {
    const engine = createEngine(800, 600);
    const labels = labelsOf(engine);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    const screen = new QRectF(0, 0, 800, 600);
    for (const label of labels) {
      expect(label.text).toMatch(/^[XYZ][+-]$/);
      expect(screen.contains(label.bounds)).toBe(true);
      const axis = 'XYZ'.indexOf(label.text[0]);
      const dir = axisDirection(axis);
      expect(distanceToProjectedLine(engine, label.anchor, dir.mul(-1), dir.mul(1))).toBeLessThan(1e-3);
      expect(label.bounds.width).toBe(2 * 7 + 8);
      expect(label.bounds.height).toBe(13 + 4);
      expect(label.bounds.center().x).toBeCloseTo(label.anchor.x, 9);
    }
    for (let a = 0; a < labels.length; ++a)
      for (let b = a + 1; b < labels.length; ++b) expect(labels[a].bounds.intersects(labels[b].bounds)).toBe(false);
  });

  it('uses the Link orientation signs: X+/Y+/Z+ point along the negative SDK axes', () => {
    const engine = createEngine(800, 600);
    const labels = labelsOf(engine);
    const zPlus = labels.find((label) => label.text === 'Z+');
    const zMinus = labels.find((label) => label.text === 'Z-');
    expect(zPlus).toBeDefined();
    expect(zMinus).toBeDefined();
    expect(zPlus!.anchor.y).toBeGreaterThan(300);
    expect(zMinus!.anchor.y).toBeLessThan(300);
    expect(zPlus!.color).toEqual({ r: 95, g: 145, b: 255, a: 255 });
  });

  it('slides along the axis to avoid the point list and the Select button', () => {
    const engine = createEngine(800, 600);
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const points = engine.pointLabelPanel();
    expect(points.isVisible()).toBe(true);
    const occupied = occupiedAreas(engine);
    expect(occupied).toHaveLength(2);
    for (const label of labelsOf(engine))
      for (const area of occupied) expect(area.intersects(label.bounds)).toBe(false);
  });

  it('shows no labels in viewports smaller than 80 px', () => {
    expect(labelsOf(createEngine(79, 600))).toEqual([]);
    expect(labelsOf(createEngine(600, 60))).toEqual([]);
  });

  it('clips axes behind the camera before projecting', () => {
    const engine = createEngine(800, 600);
    engine.camera().yaw = 0;
    engine.camera().pitch = 0;
    const labels = labelsOf(engine);
    for (const label of labels) {
      expect(Number.isFinite(label.anchor.x)).toBe(true);
      expect(Number.isFinite(label.anchor.y)).toBe(true);
    }
    expect(labels.some((label) => label.text[0] === 'X')).toBe(false);
  });
});

// World axis labels (Viewport3D::worldAxisLabels): X+/X-, Y+/Y-, Z+/Z- sit on
// the projected world axes near the viewport edges and avoid lists/controls.
import { describe, expect, it } from 'vitest';
import { connectorOrientations, previewOrientationDirection } from '../../src/geometry/ConnectorPreview';
import { QRectF } from '../../src/renderer/Rect';
import { QPointF, QVector3D } from '../../src/renderer/Vector3D';
import type { AxisLabel } from '../../src/renderer/ViewportEngine';
import { createEngine, internals, resultWithP0 } from './helpers';
import type { ViewportEngine } from '../../src/renderer/ViewportEngine';

function labelsOf(engine: ViewportEngine): AxisLabel[] {
  const i = internals(engine);
  i.updateViewMatrix();
  i.updateProjectionMatrix();
  return i.worldAxisLabels();
}

/** Distance from p to the infinite screen line through the projections of a and b. */
function distanceToProjectedLine(engine: ViewportEngine, p: QPointF, a: QVector3D, b: QVector3D): number {
  const i = internals(engine);
  const transform = i.m_projection.times(i.m_view);
  const toScreen = (v: QVector3D) => {
    const c = transform.map({ x: v.x, y: v.y, z: v.z, w: 1 } as never);
    return new QPointF((c.x / c.w + 1) * engine.width() * 0.5, (1 - c.y / c.w) * engine.height() * 0.5);
  };
  const pa = toScreen(a),
    pb = toScreen(b);
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
      // Anchors lie on the projected axis (points on both sides of the target, in front of the camera).
      expect(distanceToProjectedLine(engine, label.anchor, dir.mul(-1), dir.mul(1))).toBeLessThan(1e-3);
      // Bounds are centered on the anchor, text advance + 8 by height + 4 (fixed 7 px glyphs, height 13).
      expect(label.bounds.width).toBe(2 * 7 + 8);
      expect(label.bounds.height).toBe(13 + 4);
      expect(label.bounds.center().x).toBeCloseTo(label.anchor.x, 9);
    }
    // Labels never overlap each other.
    for (let a = 0; a < labels.length; ++a)
      for (let b = a + 1; b < labels.length; ++b) expect(labels[a].bounds.intersects(labels[b].bounds)).toBe(false);
  });

  it('uses the Link orientation signs: X+/Y+/Z+ point along the negative SDK axes', () => {
    const engine = createEngine(800, 600);
    const labels = labelsOf(engine);
    const zPlus = labels.find((label) => label.text === 'Z+');
    const zMinus = labels.find((label) => label.text === 'Z-');
    // World +Z is up on screen, so the Z+ label (direction (0,0,-1)) is at the bottom edge.
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
    const occupied = [
      QRectF.fromRect(points.geometry()).adjusted(-4, -4, 4, 4),
      QRectF.fromRect(engine.selectionModeButton().geometry).adjusted(-4, -4, 4, 4),
    ];
    for (const label of labelsOf(engine))
      for (const area of occupied) expect(area.intersects(label.bounds)).toBe(false);
  });

  it('shows no labels in viewports smaller than 80 px', () => {
    expect(labelsOf(createEngine(79, 600))).toEqual([]);
    expect(labelsOf(createEngine(600, 60))).toEqual([]);
  });

  it('clips axes behind the camera before projecting', () => {
    // Looking almost straight down the X axis: one half of it is behind the eye.
    const engine = createEngine(800, 600);
    const i = internals(engine);
    i.m_yaw = 0;
    i.m_pitch = 0;
    i.buildAxesVertices();
    const labels = labelsOf(engine);
    for (const label of labels) {
      expect(Number.isFinite(label.anchor.x)).toBe(true);
      expect(Number.isFinite(label.anchor.y)).toBe(true);
    }
    // The X axis projects to (nearly) a point at the center: it reaches no edge, so it gets no label.
    expect(labels.some((label) => label.text[0] === 'X')).toBe(false);
  });
});

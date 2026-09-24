// ViewportEngine (port of renderer/Viewport3D): projection / unprojection,
// picking, click handling, camera navigation and the vector arrow geometry.
import { describe, expect, it, vi } from 'vitest';
import { LeftButton, RightButton } from '../../src/renderer/QtEvents';
import { QPointF, QVector3D } from '../../src/renderer/Vector3D';
import { VertexArray } from '../../src/renderer/VertexArray';
import { DebugItem, debugValueText } from '../../src/renderer/ViewportEngine';
import { boxMesh, createEngine, internals, mouse, project, resultWithP0, scene } from './helpers';

describe('projection', () => {
  it('projects the camera target to the viewport center', () => {
    const engine = createEngine(800, 600);
    const center = project(engine, new QVector3D(0, 0, 0));
    expect(center.x).toBeCloseTo(400, 3);
    expect(center.y).toBeCloseTo(300, 3);
  });

  it('uses a 45 degree vertical field of view with the widget aspect ratio', () => {
    const engine = createEngine(800, 600);
    const i = internals(engine);
    i.updateProjectionMatrix();
    const f = 1 / Math.tan(22.5 * Math.PI / 180);
    expect(i.m_projection.get(1, 1)).toBeCloseTo(f, 5);
    expect(i.m_projection.get(0, 0)).toBeCloseTo(f / (800 / 600), 5);
    // nearPlane = max(0.001, min(10000, distance * 0.001)); farPlane >= 1000
    const near = 18 * 0.001;
    const far = Math.max(1000, 18 + 60, near * 1000);
    expect(i.m_projection.get(2, 3)).toBeCloseTo(-(2 * near * far) / (far - near), 5);
  });

  it('screenRay() passes through the projected point', () => {
    const engine = createEngine(640, 480);
    const world = new QVector3D(2, -3, 1.5);
    const screen = project(engine, world);
    const ray = internals(engine).screenRay(screen);
    const direction = ray.farPoint.sub(ray.nearPoint);
    const t = QVector3D.dotProduct(world.sub(ray.nearPoint), direction) / direction.lengthSquared();
    const closest = ray.nearPoint.add(direction.mul(t));
    expect(closest.sub(world).length()).toBeLessThan(1e-3);
  });

  it('screenToGroundPlane() returns the clicked z = 0 point', () => {
    const engine = createEngine(800, 600);
    const ground = new QVector3D(3.25, -1.5, 0);
    const hit = internals(engine).screenToGroundPlane(project(engine, ground));
    expect(hit.x).toBeCloseTo(ground.x, 2);
    expect(hit.y).toBeCloseTo(ground.y, 2);
    expect(hit.z).toBe(0);
  });

  it('does not project points behind the camera', () => {
    const engine = createEngine(800, 600);
    const i = internals(engine);
    i.updateViewMatrix();
    i.updateProjectionMatrix();
    const eye = i.cameraPosition() as QVector3D;
    const behind = eye.add(eye.sub(new QVector3D()).normalized().mul(5));
    expect(i.projectToScreen(behind)).toBeNull();
  });
});

describe('mesh picking', () => {
  it('intersects actual triangles and keeps the nearest hit', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 0), boxMesh([-0.5, -0.5, 4], [0.5, 0.5, 5], 1)));
    const i = internals(engine);
    i.updateViewMatrix();
    i.updateProjectionMatrix();
    expect(i.pickMesh(new QPointF(400, 300))).toBe(0);
    expect(i.pickMesh(new QPointF(5, 5))).toBe(-1);
    const above = project(engine, new QVector3D(0, 0, 4.5));
    expect(i.pickMesh(above)).toBe(1);
  });

  it('prefers the triangle closest to the camera', () => {
    const engine = createEngine();
    // Camera looks from +x/-y/+z (yaw -45, pitch 28): the box nearer to the eye wins.
    const i = internals(engine);
    i.updateViewMatrix();
    const eye = i.cameraPosition() as QVector3D;
    const toward = eye.normalized().mul(4);
    const nearBox = boxMesh([toward.x - 0.5, toward.y - 0.5, toward.z - 0.5], [toward.x + 0.5, toward.y + 0.5, toward.z + 0.5], 7);
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 3), nearBox));
    i.updateViewMatrix();
    i.updateProjectionMatrix();
    expect(i.pickMesh(project(engine, toward))).toBe(1);
  });

  it('ignores hidden geometry and API-filtered meshes', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 0)));
    const i = internals(engine);
    i.updateViewMatrix();
    i.updateProjectionMatrix();
    engine.setApiFocusIndices(new Set([5]));
    expect(i.pickMesh(new QPointF(400, 300))).toBe(-1);
    engine.clearApiFocus();
    expect(i.pickMesh(new QPointF(400, 300))).toBe(0);
    engine.setShowGeometry(false);
    expect(i.pickMesh(new QPointF(400, 300))).toBe(-1);
  });

  it('selects the whole API invocation from a Mesh-mode click', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 4), boxMesh([2, 2, 2], [3, 3, 3], 4), boxMesh([-9, 5, 0], [-8, 6, 1], 5)));
    const onMesh = vi.fn();
    engine.setMeshSelectionCallback(onMesh);
    engine.selectionModeButtonClicked(); // Vector
    engine.selectionModeButtonClicked(); // Mesh
    expect(engine.selectionModeButton().text).toBe('Mesh');
    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseReleaseEvent(mouse(400, 300, LeftButton, 0));
    expect(onMesh).toHaveBeenCalledWith(4, 5);
    expect(engine.selectedMeshIndex()).toBe(0);
    expect(engine.isMeshSelected(1)).toBe(true);
    expect(engine.isMeshSelected(2)).toBe(false);
    // Scene replacement clears the mesh selection.
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 4)));
    expect(engine.selectedMeshIndex()).toBe(-1);
  });
});

describe('debug points and clicks', () => {
  it('snaps points within 18 logical pixels', () => {
    const engine = createEngine();
    engine.setRuntimeResult(resultWithP0(1, 2, 0.5));
    const screen = project(engine, new QVector3D(1, 2, 0.5));
    const i = internals(engine);
    expect(i.pickDebugItem(new QPointF(screen.x + 17.5, screen.y), 'Point')).toBe('p0');
    expect(i.pickDebugItem(new QPointF(screen.x + 18.5, screen.y), 'Point')).toBe('');
    // A missed point never falls through to vectors or meshes.
    expect(i.pickDebugItem(screen, 'Vector')).toBe('');
  });

  it('click selects p0; Shift-click toggles it', () => {
    const engine = createEngine();
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    engine.mousePressEvent(mouse(402, 301, LeftButton, LeftButton));
    engine.mouseReleaseEvent(mouse(402, 301, LeftButton, 0));
    expect(onSelection).toHaveBeenLastCalledWith(new Set(['p0']));
    expect(engine.selectedDebugItems()).toEqual(new Set(['p0']));
    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton, { shift: true }));
    engine.mouseReleaseEvent(mouse(400, 300, LeftButton, 0, { shift: true }));
    expect(onSelection).toHaveBeenLastCalledWith(new Set());
  });

  it('Ctrl-click in Point mode creates a ground point instead of selecting', () => {
    const engine = createEngine();
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onPoint = vi.fn();
    const onSelection = vi.fn();
    engine.setPointCreationCallback(onPoint);
    engine.setSelectionChangedCallback(onSelection);
    const target = project(engine, new QVector3D(2, 1, 0));
    engine.mousePressEvent(mouse(target.x, target.y, LeftButton, LeftButton, { control: true }));
    engine.mouseReleaseEvent(mouse(target.x, target.y, LeftButton, 0, { control: true }));
    expect(onSelection).not.toHaveBeenCalled();
    expect(onPoint).toHaveBeenCalledTimes(1);
    const point = onPoint.mock.calls[0][0];
    expect(point.x).toBeCloseTo(2, 1);
    expect(point.y).toBeCloseTo(1, 1);
    expect(point.z).toBe(0);
  });

  it('a drag of 5 or more pixels orbits instead of clicking', () => {
    const engine = createEngine();
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    const i = internals(engine);

    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(404, 300, 0, LeftButton));
    expect(i.m_yaw).toBe(-45);
    engine.mouseReleaseEvent(mouse(404, 300, LeftButton, 0));
    expect(onSelection).toHaveBeenCalledTimes(1);

    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(410, 296, 0, LeftButton));
    expect(i.m_yaw).toBeCloseTo(-45 - 10 * 0.35);
    expect(i.m_pitch).toBeCloseTo(28 - 4 * 0.35);
    engine.mouseReleaseEvent(mouse(410, 296, LeftButton, 0));
    expect(onSelection).toHaveBeenCalledTimes(1);
  });

  it('right-drag pans the target in the view plane', () => {
    const engine = createEngine();
    const i = internals(engine);
    engine.mousePressEvent(mouse(400, 300, RightButton, RightButton));
    engine.mouseMoveEvent(mouse(400, 280, 0, RightButton));
    const target = i.m_target as QVector3D;
    // Dragging down-to-up moves the target along the camera up vector only.
    expect(target.length()).toBeCloseTo(20 * 18 * 0.0018, 4);
    expect(target.z).toBeLessThan(0);
  });

  it('wheel zooms by 0.86 per notch', () => {
    const engine = createEngine();
    const i = internals(engine);
    engine.wheelEvent({ x: 400, y: 300, angleDeltaY: 120 });
    expect(i.m_distance).toBeCloseTo(18 * 0.86, 5);
    engine.wheelEvent({ x: 400, y: 300, angleDeltaY: -240 });
    expect(i.m_distance).toBeCloseTo(18 / 0.86, 5);
  });

  it('fitScene() frames the visible geometry', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([10, 10, 0], [14, 12, 2], 0)));
    engine.fitScene();
    const i = internals(engine);
    const target = i.m_target as QVector3D;
    expect([target.x, target.y, target.z]).toEqual([12, 11, 1]);
    const radius = 0.5 * Math.hypot(4, 2, 2);
    const expected = radius / Math.tan(22.5 * Math.PI / 180) * 1.18 + Math.max(2, radius * 0.05);
    expect(i.m_distance).toBeCloseTo(expected, 5);
  });

  it('shows only p0 in the overview Points list', () => {
    const engine = createEngine();
    engine.setRuntimeResult(resultWithP0(1.5, -2, 1e-7));
    const points = engine.pointLabelPanel();
    expect(points.entries()).toEqual([{ id: 'p0', name: 'p0', value: '(1.5, -2, 1e-07)' }]);
    expect(points.isVisible()).toBe(true);
    expect(points.headerText()).toBe('Points  (1)');
    expect(engine.vectorLabelPanel().isVisible()).toBe(false);
  });

  it('formats debug values like QString::arg(x, 0, \'g\', 7)', () => {
    expect(debugValueText({ x: 0.1 + 0.2, y: 1234567.8, z: 0 })).toBe('(0.3, 1234568, 0)');
    expect(debugValueText({ x: 12345678, y: 1e-5, z: 2.5 })).toBe('(1.234568e+07, 1e-05, 2.5)');
  });
});

describe('vector arrows', () => {
  function arrowFor(start: QVector3D, end: QVector3D) {
    const engine = createEngine();
    const item = new DebugItem();
    item.kind = 'Vector';
    item.start = start;
    item.end = end;
    const vertices = new VertexArray();
    internals(engine).appendVectorArrow(vertices, item, false);
    return { engine, vertices };
  }

  it('is one shaft plus a camera-facing V head', () => {
    const start = new QVector3D(1, 1, 0);
    const end = new QVector3D(1, 1, 5);
    const { engine, vertices } = arrowFor(start, end);
    expect(vertices.size()).toBe(6);
    expect(vertices.position(0)).toEqual(start);
    expect(vertices.position(1)).toEqual(end);
    expect(vertices.position(2)).toEqual(end);
    expect(vertices.position(4)).toEqual(end);

    // headLength = clamp(5 * 0.18, max(0.12, 10 * 0.006), max(0.5, 10 * 0.035)) = 0.5 (scene scale 10)
    const headLength = 0.5;
    const wing = headLength * 0.52;
    const w1 = vertices.position(3), w2 = vertices.position(5);
    const base = end.sub(new QVector3D(0, 0, headLength));
    // (Vertices are stored as floats, like the C++ Vertex struct.)
    expect(w1.add(w2).mul(0.5).sub(base).length()).toBeLessThan(1e-6);
    expect(w1.sub(base).length()).toBeCloseTo(wing, 6);
    const side = w1.sub(base).normalized();
    expect(QVector3D.dotProduct(side, new QVector3D(0, 0, 1))).toBeCloseTo(0, 6);
    const toCamera = (internals(engine).cameraPosition() as QVector3D).sub(end).normalized();
    expect(QVector3D.dotProduct(side, toCamera)).toBeCloseTo(0, 6);
    // Colors: unselected (0.20, 0.78, 1.0).
    const data = vertices.data();
    expect([data[3], data[4], data[5]]).toEqual([Math.fround(0.2), Math.fround(0.78), 1]);
  });

  it('draws nothing for a zero-length vector', () => {
    const { vertices } = arrowFor(new QVector3D(1, 2, 3), new QVector3D(1, 2, 3));
    expect(vertices.size()).toBe(0);
  });

  it('clamps the head for short vectors', () => {
    const { vertices } = arrowFor(new QVector3D(0, 0, 0), new QVector3D(0.2, 0, 0));
    const base = vertices.position(3).add(vertices.position(5)).mul(0.5);
    // max(0.12, 10 * 0.006) = 0.12
    expect(new QVector3D(0.2, 0, 0).sub(base).length()).toBeCloseTo(0.12, 6);
  });

  it('snaps vectors within 12 pixels of the shaft or head', () => {
    const engine = createEngine();
    const i = internals(engine);
    const item = new DebugItem();
    item.kind = 'Vector';
    item.name = '@api0:vector:normal';
    item.apiIndex = 0;
    item.apiSnapshot = true;
    item.start = new QVector3D(0, 0, 0);
    item.end = new QVector3D(0, 0, 4);
    i.m_debugItems = [item];
    engine.setApiFocusIndices(new Set([0]));
    const a = project(engine, item.start);
    const b = project(engine, new QVector3D(0, 0, 2));
    const mid = new QPointF((a.x + b.x) / 2, (a.y + b.y) / 2);
    expect(i.pickDebugItem(new QPointF(mid.x + 11, mid.y), 'Vector')).toBe(item.name);
    expect(i.pickDebugItem(new QPointF(mid.x + 13, mid.y), 'Vector')).toBe('');
  });
});

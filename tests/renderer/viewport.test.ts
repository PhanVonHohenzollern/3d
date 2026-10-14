import { describe, expect, it, vi } from 'vitest';
import { LeftButton, MiddleButton, RightButton } from '@/shared/lib/qt';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { boxMesh, click, createEngine, mouse, project, resultWithP0, scene } from '@tests/renderer/helpers';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { buildConnectorPreview, defaultConnectorDefinition } from '@engine/geometry/ConnectorPreview';

function meshModeEngine() {
  const engine = createEngine();
  engine.setSelectionMode('Mesh');
  const onMesh = vi.fn();
  engine.setMeshSelectionCallback(onMesh);

  return { engine, onMesh };
}

describe('Mesh mode', () => {
  it.each(['Mesh', 'Point', 'Vector'] as const)(
    'empty click clears selection in %s mode without changing the camera',
    (mode) => {
      const engine = createEngine();
      engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 0)));
      engine.setSelectedApiCall(0);
      engine.setApiFocusIndices(new Set([0]));
      engine.setSelectedVariable('p0');
      engine.toggleIsolation();
      engine.setSelectionMode(mode);
      const camera = engine.camera();
      const before = [camera.target, camera.orientation, camera.distance];
      const cleared = vi.fn();
      engine.setSelectionClearedCallback(cleared);
      click(engine, 790, 590);
      expect(cleared).toHaveBeenCalledOnce();
      expect(engine.hasApiFocus()).toBe(false);
      expect(engine.selectedDebugItems().size).toBe(0);
      expect(engine.isSelectionIsolated()).toBe(false);
      expect(engine.isMeshSelected(0)).toBe(false);
      expect([camera.target, camera.orientation, camera.distance]).toEqual(before);
    },
  );
  it('Context selection cycles through occluded meshes without clearing API focus', () => {
    const { engine, onMesh } = meshModeEngine();
    engine.setGeometryScene(scene(boxMesh([-2, -2, -2], [2, 2, 2], 0), boxMesh([-1, -1, -1], [1, 1, 1], 1)));
    engine.setApiFocusIndices(new Set([0]));
    expect(engine.isSelectionIsolated()).toBe(false);
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(0, 1);
    engine.setApiFocusIndices(new Set([0]));
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(1, 2);
    engine.setApiFocusIndices(new Set([1]));
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(0, 1);
    engine.toggleIsolation();
    expect(engine.isSelectionIsolated()).toBe(true);
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(1, 2);
  });
  it('selects the whole API invocation from a click', () => {
    const { engine, onMesh } = meshModeEngine();
    engine.setGeometryScene(
      scene(boxMesh([-1, -1, -1], [1, 1, 1], 4), boxMesh([2, 2, 2], [3, 3, 3], 4), boxMesh([-9, 5, 0], [-8, 6, 1], 5)),
    );
    expect(engine.selectionModeButton().text).toBe('Mesh');
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenCalledWith(4, 5);
    expect(engine.selectedMeshIndex()).toBe(0);
    expect(engine.isMeshSelected(1)).toBe(true);
    expect(engine.isMeshSelected(2)).toBe(false);
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 4)));
    expect(engine.selectedMeshIndex()).toBe(-1);
  });

  it('cannot pick API-filtered or hidden geometry', () => {
    const { engine, onMesh } = meshModeEngine();
    engine.setGeometryScene(scene(boxMesh([-1, -1, -1], [1, 1, 1], 0)));
    engine.setApiFocusIndices(new Set([5]));
    engine.toggleIsolation();
    click(engine, 400, 300);
    expect(onMesh).not.toHaveBeenCalled();
    engine.clearApiFocus();
    engine.setShowGeometry(false);
    click(engine, 400, 300);
    expect(onMesh).not.toHaveBeenCalled();
    engine.setShowGeometry(true);
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenCalledWith(0, 1);
  });

  it('cycles Point, Vector and Mesh', () => {
    const engine = createEngine();
    const texts = [engine.selectionModeButton().text];
    for (let i = 0; i < 3; ++i) {
      engine.selectionModeButtonClicked();
      texts.push(engine.selectionModeButton().text);
    }
    expect(texts).toEqual(['Mesh', 'Point', 'Vector', 'Mesh']);
  });

  it('chooses a mode directly and uses it for the next click', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([-2, -2, -2], [2, 2, 2], 0)));
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onMesh = vi.fn();
    const onPoint = vi.fn();
    engine.setMeshSelectionCallback(onMesh);
    engine.setSelectionChangedCallback(onPoint);
    engine.setSelectionMode('Mesh');
    expect(engine.selectionModeButton().text).toBe('Mesh');
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenCalledWith(0, 1);
    expect(onPoint).not.toHaveBeenCalled();
    engine.setSelectionMode('Point');
    click(engine, 400, 300);
    expect(onPoint).toHaveBeenCalledWith(new Set(['p0']));
    expect(onMesh).toHaveBeenCalledTimes(1);
    engine.setSelectionMode('Vector');
    expect(engine.selectionMode()).toBe('Vector');
    expect(engine.selectionModeButton().text).toBe('Vector');
  });
});

describe('debug points and clicks', () => {
  it.each(['Point', 'Vector'] as const)(
    'Context selection cycles overlapping %s snapshots across API calls',
    (kind) => {
      const engine = createEngine();
      const source = 'makeFlatDisc(FdPoint3d(0,0,0), vz, 2, 8);\nmakeFlatDisc(FdPoint3d(0,0,0), vz, 3, 8);';
      engine.setRuntimeResult(new GeometryRuntime().executeUpToLine(source, 999));
      engine.setGeometryScene(scene(boxMesh([-2, -2, -2], [2, 2, 2], 8)));
      engine.setApiFocusIndices(new Set([0]));
      engine.setSelectionMode(kind);
      const selected = vi.fn();
      engine.setSelectionChangedCallback(selected);
      click(engine, 400, 300);
      expect([...engine.selectedDebugItems()][0]).toContain(`@api0:${kind.toLowerCase()}:`);
      engine.setApiFocusIndices(new Set([0]));
      click(engine, 400, 300);
      expect([...engine.selectedDebugItems()][0]).toContain(`@api1:${kind.toLowerCase()}:`);
      expect(selected).toHaveBeenCalledTimes(2);
    },
  );
  it('click selects p0; Shift-click toggles it', () => {
    const engine = createEngine();
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    click(engine, 402, 301);
    expect(onSelection).toHaveBeenLastCalledWith(new Set(['p0']));
    expect(engine.selectedDebugItems()).toEqual(new Set(['p0']));
    click(engine, 400, 300, { shift: true });
    expect(onSelection).toHaveBeenLastCalledWith(new Set());
  });

  it('Ctrl-click in Point mode creates a ground point instead of selecting', () => {
    const engine = createEngine();
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onPoint = vi.fn();
    const onSelection = vi.fn();
    engine.setPointCreationCallback(onPoint);
    engine.setSelectionChangedCallback(onSelection);
    const target = project(engine, new QVector3D(2, 1, 0));
    click(engine, target.x, target.y, { control: true });
    expect(onSelection).not.toHaveBeenCalled();
    expect(onPoint).toHaveBeenCalledTimes(1);
    const point = onPoint.mock.calls[0][0];
    expect(point.x).toBeCloseTo(2, 1);
    expect(point.y).toBeCloseTo(1, 1);
    expect(point.z).toBe(0);
  });

  it('a drag of 5 or more pixels orbits instead of clicking', () => {
    const engine = createEngine();
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    const camera = engine.camera();

    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(404, 300, 0, LeftButton));
    expect(camera.orientation).toEqual(ViewportCamera.homeOrientation());
    engine.mouseReleaseEvent(mouse(404, 300, LeftButton, 0));
    expect(onSelection).toHaveBeenCalledTimes(1);

    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(410, 296, 0, LeftButton));
    expect(camera.orientation).not.toEqual(ViewportCamera.homeOrientation());
    engine.mouseReleaseEvent(mouse(410, 296, LeftButton, 0));
    expect(onSelection).toHaveBeenCalledTimes(1);
  });

  it('middle-drag pans the target in the view plane without selecting', () => {
    const engine = createEngine();
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    engine.mousePressEvent(mouse(400, 300, MiddleButton, MiddleButton));
    engine.mouseMoveEvent(mouse(400, 280, 0, MiddleButton));
    engine.mouseReleaseEvent(mouse(400, 280, MiddleButton, 0));
    const target = engine.camera().target;
    expect(target.length()).toBeCloseTo(20 * 18 * 0.0018, 4);
    expect(target.z).toBeLessThan(0);
    expect(engine.camera().orientation).toEqual(ViewportCamera.homeOrientation());
    expect(onSelection).not.toHaveBeenCalled();
  });

  it('uses the same orbit motion at the center and edges of the viewport', () => {
    const orientations = [];
    for (const [x, y] of [
      [400, 300],
      [10, 10],
      [790, 590],
    ]) {
      const engine = createEngine();
      engine.mousePressEvent(mouse(x, y, LeftButton, LeftButton));
      engine.mouseMoveEvent(mouse(x + 30, y - 40, 0, LeftButton));
      engine.mouseReleaseEvent(mouse(x + 30, y - 40, LeftButton, 0));
      orientations.push(engine.camera().orientation);
    }
    expect(orientations[0]).not.toEqual(ViewportCamera.homeOrientation());
    expect(orientations[1]).toEqual(orientations[0]);
    expect(orientations[2]).toEqual(orientations[0]);
  });

  it('orbits an off-origin model around its center after Pan/Zoom, ignoring distant debug items and connectors', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([10, 20, 30], [20, 30, 40])));
    engine.setRuntimeResult(resultWithP0(1000, 0, 0));
    engine.setConnectorPreviews(
      [buildConnectorPreview({ ...defaultConnectorDefinition(), diameter: '4', position: ['2000', '0', '0'] }, Number)],
      -1,
    );
    const camera = engine.camera();
    const center = new QVector3D(15, 25, 35);
    camera.fitBounds(new QVector3D(10, 20, 30), new QVector3D(20, 30, 40));
    engine.mousePressEvent(mouse(400, 300, MiddleButton, MiddleButton));
    engine.mouseMoveEvent(mouse(440, 320, 0, MiddleButton));
    engine.mouseReleaseEvent(mouse(440, 320, MiddleButton, 0));
    engine.wheelEvent({ x: 440, y: 320, angleDeltaY: 120 });
    const initialCenter = project(engine, center);
    const initialEye = camera.cameraPosition();
    const radius = initialEye.sub(center).length();
    const distance = camera.distance;
    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    expect(camera.cameraPosition()).toEqual(initialEye);
    for (const [x, y] of [
      [450, 350],
      [500, 500],
      [200, 500],
      [100, 100],
    ]) {
      engine.mouseMoveEvent(mouse(x, y, 0, LeftButton));
      const projectedCenter = project(engine, center);
      expect(projectedCenter.x).toBeCloseTo(initialCenter.x, 3);
      expect(projectedCenter.y).toBeCloseTo(initialCenter.y, 3);
      expect(camera.cameraPosition().sub(center).length()).toBeCloseTo(radius, 8);
      expect(camera.distance).toBe(distance);
    }
    expect(camera.cameraPosition().sub(initialEye).length()).toBeGreaterThan(1);
    engine.mouseReleaseEvent(mouse(100, 100, LeftButton, 0));
  });

  it('updates the orbit center to visible geometry when isolation changes between drags', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([-30, -1, -1], [-20, 1, 1], 0), boxMesh([20, -1, -1], [30, 1, 1], 1)));
    engine.fitScene();
    engine.setSelectedApiCall(1);
    for (const center of [new QVector3D(), new QVector3D(25, 0, 0)]) {
      const before = project(engine, center);
      engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
      engine.mouseMoveEvent(mouse(450, 340, 0, LeftButton));
      engine.mouseReleaseEvent(mouse(450, 340, LeftButton, 0));
      const after = project(engine, center);
      expect(after.x).toBeCloseTo(before.x, 3);
      expect(after.y).toBeCloseTo(before.y, 3);
      engine.toggleIsolation();
    }
  });

  it('orbits visible debug items when geometry is hidden', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([100, 100, 100], [110, 110, 110])));
    engine.setRuntimeResult(resultWithP0(1, 2, 3));
    engine.setShowGeometry(false);
    engine.fitScene();
    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(450, 350, 0, LeftButton));
    engine.mouseReleaseEvent(mouse(450, 350, LeftButton, 0));
    expect(engine.camera().target).toEqual(new QVector3D(1, 2, 3));
  });

  it('right-click and right-drag leave camera and selection unchanged', () => {
    const engine = createEngine();
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    for (const dy of [0, 20]) {
      engine.mousePressEvent(mouse(400, 300, RightButton, RightButton));
      engine.mouseMoveEvent(mouse(400, 300 + dy, 0, RightButton));
      engine.mouseReleaseEvent(mouse(400, 300 + dy, RightButton, 0));
    }
    expect(engine.camera().target.length()).toBe(0);
    expect(engine.camera().orientation).toEqual(ViewportCamera.homeOrientation());
    expect(engine.selectionMode()).toBe('Point');
    expect(onSelection).not.toHaveBeenCalled();
  });

  it.each(['Mesh', 'Point', 'Vector'] as const)('left-drag orbits without sweep selection in %s mode', (mode) => {
    const engine = createEngine();
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    engine.setSelectionMode(mode);
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    engine.setMeshSelectionCallback(onSelection);
    engine.setConnectorSelectionCallback(onSelection);
    engine.mousePressEvent(mouse(450, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(350, 300, 0, LeftButton));
    engine.mouseReleaseEvent(mouse(350, 300, LeftButton, 0));
    expect(engine.camera().orientation).not.toEqual(ViewportCamera.homeOrientation());
    expect(engine.camera().target.length()).toBe(0);
    expect(onSelection).not.toHaveBeenCalled();
  });

  it('wheel zooms by 0.86 per notch', () => {
    const engine = createEngine();
    engine.wheelEvent({ x: 400, y: 300, angleDeltaY: 120 });
    expect(engine.camera().distance).toBeCloseTo(18 * 0.86, 5);
    engine.wheelEvent({ x: 400, y: 300, angleDeltaY: -240 });
    expect(engine.camera().distance).toBeCloseTo(18 / 0.86, 5);
  });

  it('fitScene() frames the visible geometry', () => {
    const engine = createEngine();
    const mesh = boxMesh([10, 10, 0], [14, 12, 2], 0);
    engine.setGeometryScene(scene(mesh));
    engine.fitScene();
    const { target } = engine.camera();
    expect([target.x, target.y, target.z]).toEqual([12, 11, 1]);
    for (const vertex of mesh.vertices) {
      const point = project(engine, new QVector3D(vertex.x, vertex.y, vertex.z));
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(engine.width());
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(engine.height());
    }
  });

  it('fitDebugOverlay() resets the camera when nothing is visible', () => {
    const engine = createEngine();
    engine.wheelEvent({ x: 400, y: 300, angleDeltaY: 360 });
    engine.fitDebugOverlay();
    expect(engine.camera().distance).toBe(18);
  });

  it('shows only p0 in the overview Points list', () => {
    const engine = createEngine();
    engine.setRuntimeResult(resultWithP0(1.5, -2, 1e-7));
    const points = engine.pointLabelPanel();
    expect(points.entries()).toEqual([{ id: 'p0', name: 'p0', value: '(1.5, -2, 0)' }]);
    expect(points.isVisible()).toBe(true);
    expect(points.headerText()).toBe('Points  (1)');
    expect(engine.vectorLabelPanel().isVisible()).toBe(false);
  });

  it('lays out the lists above the floating selection button', () => {
    const engine = createEngine(1000, 700);
    engine.setSelectionMode('Point');
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const button = engine.selectionModeButton().geometry;
    expect([button.x, button.y, button.width, button.height]).toEqual([8, 700 - 8 - 32, 96, 32]);
    const points = engine.pointLabelPanel().geometry();
    expect([points.x, points.y, points.width, points.height]).toEqual([8, 8, 440, 49]);
    engine.setShowLabels(false);
    expect(engine.pointLabelPanel().isVisible()).toBe(false);
  });
});

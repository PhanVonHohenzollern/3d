import { describe, expect, it, vi } from 'vitest';
import { LeftButton, RightButton } from '../../src/helpers/qtInput';
import { QVector3D } from '../../src/utils/Vector3D';
import { boxMesh, click, createEngine, mouse, project, resultWithP0, scene } from './helpers';
import { GeometryRuntime } from '../../src/core/runtime/GeometryRuntime';

function meshModeEngine() {
  const engine = createEngine();
  engine.selectionModeButtonClicked();
  engine.selectionModeButtonClicked();
  const onMesh = vi.fn();
  engine.setMeshSelectionCallback(onMesh);

  return { engine, onMesh };
}

describe('Mesh mode', () => {
  it('Unite cycles through occluded meshes without clearing API focus', () => {
    const { engine, onMesh } = meshModeEngine();
    engine.setGeometryScene(scene(boxMesh([-2, -2, -2], [2, 2, 2], 0), boxMesh([-1, -1, -1], [1, 1, 1], 1)));
    engine.setApiFocusIndices(new Set([0]));
    engine.toggleSelectionPresentation();
    expect(engine.selectionPresentation()).toBe('Unite');
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(0, 1);
    engine.setApiFocusIndices(new Set([0]));
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(1, 2);
    engine.setApiFocusIndices(new Set([1]));
    click(engine, 400, 300);
    expect(onMesh).toHaveBeenLastCalledWith(0, 1);
    engine.toggleSelectionPresentation();
    expect(engine.selectionPresentation()).toBe('Separate');
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
    expect(texts).toEqual(['Point', 'Vector', 'Mesh', 'Point']);
  });
});

describe('debug points and clicks', () => {
  it.each(['Point', 'Vector'] as const)('Unite selects overlapping %s snapshots across API calls', (kind) => {
    const engine = createEngine();
    const source = 'makeFlatDisc(FdPoint3d(0,0,0), vz, 2, 8);\nmakeFlatDisc(FdPoint3d(0,0,0), vz, 3, 8);';
    engine.setRuntimeResult(new GeometryRuntime().executeUpToLine(source, 999));
    engine.setGeometryScene(scene(boxMesh([-2, -2, -2], [2, 2, 2], 8)));
    engine.setApiFocusIndices(new Set([0]));
    engine.toggleSelectionPresentation();
    if (kind === 'Vector') engine.selectionModeButtonClicked();
    const selected = vi.fn();
    engine.setSelectionChangedCallback(selected);
    click(engine, 400, 300);
    expect([...engine.selectedDebugItems()][0]).toContain(`@api0:${kind.toLowerCase()}:`);
    engine.setApiFocusIndices(new Set([0]));
    click(engine, 400, 300);
    expect([...engine.selectedDebugItems()][0]).toContain(`@api1:${kind.toLowerCase()}:`);
    expect(selected).toHaveBeenCalledTimes(2);
  });
  it('click selects p0; Shift-click toggles it', () => {
    const engine = createEngine();
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
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    const camera = engine.camera();

    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(404, 300, 0, LeftButton));
    expect(camera.yaw).toBe(-45);
    engine.mouseReleaseEvent(mouse(404, 300, LeftButton, 0));
    expect(onSelection).toHaveBeenCalledTimes(1);

    engine.mousePressEvent(mouse(400, 300, LeftButton, LeftButton));
    engine.mouseMoveEvent(mouse(410, 296, 0, LeftButton));
    expect(camera.yaw).toBeCloseTo(-45 - 10 * 0.35);
    expect(camera.pitch).toBeCloseTo(28 - 4 * 0.35);
    engine.mouseReleaseEvent(mouse(410, 296, LeftButton, 0));
    expect(onSelection).toHaveBeenCalledTimes(1);
  });

  it('right-drag pans the target in the view plane', () => {
    const engine = createEngine();
    engine.mousePressEvent(mouse(400, 300, RightButton, RightButton));
    engine.mouseMoveEvent(mouse(400, 280, 0, RightButton));
    const target = engine.camera().target;
    expect(target.length()).toBeCloseTo(20 * 18 * 0.0018, 4);
    expect(target.z).toBeLessThan(0);
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
    engine.setGeometryScene(scene(boxMesh([10, 10, 0], [14, 12, 2], 0)));
    engine.fitScene();
    const { target, distance } = engine.camera();
    expect([target.x, target.y, target.z]).toEqual([12, 11, 1]);
    const radius = 0.5 * Math.hypot(4, 2, 2);
    const expected = (radius / Math.tan((22.5 * Math.PI) / 180)) * 1.18 + Math.max(2, radius * 0.05);
    expect(distance).toBeCloseTo(expected, 5);
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
    engine.setRuntimeResult(resultWithP0(0, 0, 0));
    const button = engine.selectionModeButton().geometry;
    expect([button.x, button.y, button.width, button.height]).toEqual([8, 700 - 8 - 32, 96, 32]);
    const points = engine.pointLabelPanel().geometry();
    expect([points.x, points.y, points.width, points.height]).toEqual([8, 8, 440, 49]);
    engine.setShowLabels(false);
    expect(engine.pointLabelPanel().isVisible()).toBe(false);
  });
});

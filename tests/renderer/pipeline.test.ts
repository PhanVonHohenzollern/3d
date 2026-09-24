// End to end through the real pipeline: GeometryRuntime -> PreviewGeometryEngine
// -> ViewportEngine, driven like MainWindow drives Viewport3D.
import { describe, expect, it, vi } from 'vitest';
import { buildConnectorPreview, defaultConnectorDefinition } from '../../src/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '../../src/geometry/PreviewGeometryEngine';
import { LeftButton } from '../../src/renderer/QtEvents';
import { isApiDebugItemId } from '../../src/renderer/Viewport3DHandle';
import { QPointF, QVector3D } from '../../src/renderer/Vector3D';
import { GeometryRuntime } from '../../src/runtime/GeometryRuntime';
import { createEngine, internals, mouse, project } from './helpers';

const source = `FdPoint3d p0(0, 0, 0);
double W = 200;
FdVector3d n = vx;
FdPoint3d pts[2] = {p0, p0 + n * 500};
makeBox(1, pts, n, W, 100, true);
makeSimpleTube(pts[1], pts[1] + vz * 300, 80, 60, cpx);
`;

function run() {
  const runtime = new GeometryRuntime();
  const result = runtime.executeUpToLine(source, 6);
  const geometry = new PreviewGeometryEngine().build(result);
  const engine = createEngine(1000, 700);
  engine.setGeometryScene(geometry);
  engine.setRuntimeResult(result);
  return { runtime, result, geometry, engine };
}

describe('Viewport3D with the real pipeline', () => {
  it('shows only p0 in the overview and fits the scene once', () => {
    const { result, geometry, engine } = run();
    expect(result.diagnostics).toEqual([]);
    expect(geometry.meshes.length).toBeGreaterThan(0);
    expect(
      engine
        .pointLabelPanel()
        .entries()
        .map((e) => e.id),
    ).toEqual(['p0']);
    expect(engine.vectorLabelPanel().isVisible()).toBe(false);
    const i = internals(engine);
    expect(i.m_hasFitOnce).toBe(true);
    // All geometry is in view after the fit.
    i.updateViewMatrix();
    i.updateProjectionMatrix();
    for (const mesh of geometry.meshes)
      for (const v of mesh.vertices) expect(i.projectToScreen(new QVector3D(v.x, v.y, v.z))).not.toBeNull();
  });

  it("API focus lists the call's point/vector parameters with shared debug ids", () => {
    const { result, engine } = run();
    const boxIndex = result.apiCalls.findIndex((call) => call.name === 'makeBox');
    engine.setApiFocusIndices(new Set([boxIndex]));
    const points = engine.pointLabelPanel().entries();
    const vectors = engine.vectorLabelPanel().entries();
    expect(points.length).toBeGreaterThan(0);
    expect(vectors.length).toBeGreaterThan(0);
    for (const entry of [...points, ...vectors]) {
      expect(isApiDebugItemId(entry.id)).toBe(true);
      expect(entry.id.startsWith(`@api${boxIndex}:`)).toBe(true);
    }
    expect(points.every((entry) => entry.id.includes(':point:'))).toBe(true);
    expect(vectors.every((entry) => entry.id.includes(':vector:'))).toBe(true);
    // Labels use the call's source expressions (pts[i]), values use %g with 7 digits.
    expect(points.map((e) => e.name)).toContain('pts[1]');
    expect(points.find((e) => e.name === 'pts[1]')?.value).toBe('(500, 0, 0)');
    expect(engine.vectorLabelPanel().isVisible()).toBe(true);
    // Clearing focus restores p0.
    engine.clearApiFocus();
    expect(
      engine
        .pointLabelPanel()
        .entries()
        .map((e) => e.id),
    ).toEqual(['p0']);
  });

  it('table and viewport share one selection; Ctrl in a list keeps the other list', () => {
    const { result, engine } = run();
    const boxIndex = result.apiCalls.findIndex((call) => call.name === 'makeBox');
    engine.setApiFocusIndices(new Set([boxIndex]));
    const onSelection = vi.fn();
    engine.setSelectionChangedCallback(onSelection);
    const points = engine.pointLabelPanel();
    const vectors = engine.vectorLabelPanel();
    const rowHeight = points.rowHeight();

    points.mousePressEvent(20, rowHeight / 2, LeftButton, { control: false, shift: false, alt: false });
    points.mouseReleaseEvent(20, rowHeight / 2, LeftButton, { control: false, shift: false, alt: false });
    const pointId = points.entries()[0].id;
    expect(onSelection).toHaveBeenLastCalledWith(new Set([pointId]));

    vectors.mousePressEvent(20, rowHeight / 2, LeftButton, { control: true, shift: false, alt: false });
    vectors.mouseReleaseEvent(20, rowHeight / 2, LeftButton, { control: true, shift: false, alt: false });
    const vectorId = vectors.entries()[0].id;
    expect(onSelection).toHaveBeenLastCalledWith(new Set([pointId, vectorId]));
    expect(engine.selectedDebugItems()).toEqual(new Set([pointId, vectorId]));

    // Selected items have a leader target: their visible list row.
    expect(points.selectedRowRect(pointId).isEmpty()).toBe(false);
    expect(vectors.selectedRowRect(vectorId).isEmpty()).toBe(false);

    // A plain click in one list replaces the whole selection.
    points.mousePressEvent(20, rowHeight * 1.5, LeftButton, { control: false, shift: false, alt: false });
    points.mouseReleaseEvent(20, rowHeight * 1.5, LeftButton, { control: false, shift: false, alt: false });
    expect(engine.selectedDebugItems()).toEqual(new Set([points.entries()[1].id]));
  });

  it('hide/show debug items and prune them on a new result', () => {
    const { result, engine } = run();
    const boxIndex = result.apiCalls.findIndex((call) => call.name === 'makeBox');
    engine.setApiFocusIndices(new Set([boxIndex]));
    const first = engine.pointLabelPanel().entries()[0].id;
    engine.setDebugItemVisible(first, false);
    expect(
      engine
        .pointLabelPanel()
        .entries()
        .map((e) => e.id),
    ).not.toContain(first);
    engine.hideAllDebugItems();
    expect(engine.pointLabelPanel().entries()).toEqual([]);
    expect(engine.pointLabelPanel().isVisible()).toBe(false);
    engine.showAllDebugItems();
    expect(
      engine
        .pointLabelPanel()
        .entries()
        .map((e) => e.id),
    ).toContain(first);
    engine.setSelectedVariables(new Set([first, 'gone']));
    engine.setRuntimeResult(result);
    expect(engine.selectedDebugItems()).toEqual(new Set([first]));
  });

  it('Mesh mode selects the clicked API invocation and focus filters picking', () => {
    const { geometry, engine } = run();
    const onMesh = vi.fn();
    engine.setMeshSelectionCallback(onMesh);
    engine.selectionModeButtonClicked();
    engine.selectionModeButtonClicked();
    const mesh = geometry.meshes[0];
    const v = mesh.vertices;
    const centroid = new QVector3D(
      v.reduce((s, p) => s + p.x, 0) / v.length,
      v.reduce((s, p) => s + p.y, 0) / v.length,
      v.reduce((s, p) => s + p.z, 0) / v.length,
    );
    const screen = project(engine, centroid);
    const i = internals(engine);
    const picked = i.pickMesh(screen);
    expect(picked).toBeGreaterThanOrEqual(0);
    engine.mousePressEvent(mouse(screen.x, screen.y, LeftButton, LeftButton));
    engine.mouseReleaseEvent(mouse(screen.x, screen.y, LeftButton, 0));
    const pickedMesh = geometry.meshes[picked];
    expect(onMesh).toHaveBeenCalledWith(pickedMesh.apiIndex, pickedMesh.sourceLine);
    // Focus on another call hides this part from picking.
    engine.setApiFocusIndices(new Set([pickedMesh.apiIndex + 100]));
    expect(i.pickMesh(screen)).toBe(-1);
  });

  it('connector tests: points are pickable in Point mode and hidden under API focus', () => {
    const { runtime, engine } = run();
    const definition = {
      ...defaultConnectorDefinition(),
      id: 3,
      name: 'c',
      pointName: 'linkPoint1',
      diameter: '100',
      position: ['0', '0', '600'] as [string, string, string],
    };
    const preview = buildConnectorPreview(definition, (e) => runtime.evaluateNumericExpression(e));
    engine.setConnectorPreviews([preview], -1);
    const i = internals(engine);
    expect(i.m_connectorVertexCount).toBeGreaterThan(0);
    expect(i.m_connectorLineCount).toBeGreaterThan(0);
    const onConnector = vi.fn();
    engine.setConnectorSelectionCallback(onConnector);
    engine.fitScene();
    const screen = project(engine, new QVector3D(preview.point.x, preview.point.y, preview.point.z));
    engine.mousePressEvent(mouse(screen.x + 10, screen.y, LeftButton, LeftButton));
    engine.mouseReleaseEvent(mouse(screen.x + 10, screen.y, LeftButton, 0));
    expect(onConnector).toHaveBeenCalledWith(3);
    engine.setApiFocusIndices(new Set([0]));
    expect(i.pickConnectorPoint(new QPointF(screen.x, screen.y))).toBe(-1);
  });
});

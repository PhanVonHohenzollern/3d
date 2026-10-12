import { describe, expect, it, vi } from 'vitest';
import { buildConnectorPreview, defaultConnectorDefinition } from '@engine/geometry/ConnectorPreview';
import { PreviewGeometryEngine } from '@engine/geometry/PreviewGeometryEngine';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { appendConnectorVertices } from '@/widgets/viewport/lib/render/connectorOverlay';
import { pickMeshAlongRay } from '@/widgets/viewport/lib/render/picking';
import { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';
import { isApiDebugItemId } from '@/entities/api-call';
import { LeftButton, NoModifier } from '@/shared/lib/qt';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { boxMesh, click, createEngine, project, scene, updateCamera } from '@tests/renderer/helpers';

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
    const camera = updateCamera(engine);
    expect(camera.distance).not.toBe(18);
    for (const mesh of geometry.meshes)
      for (const v of mesh.vertices) expect(camera.projectToScreen(new QVector3D(v.x, v.y, v.z))).not.toBeNull();
    const fitted = camera.distance;
    engine.setRuntimeResult(run().result);
    expect(engine.camera().distance).toBe(fitted);
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
    expect(points.map((e) => e.name)).toContain('pts[1]');
    expect(points.find((e) => e.name === 'pts[1]')?.value).toBe('(500, 0, 0)');
    expect(engine.vectorLabelPanel().isVisible()).toBe(true);
    engine.clearApiFocus();
    expect(
      engine
        .pointLabelPanel()
        .entries()
        .map((e) => e.id),
    ).toEqual(['p0']);
  });

  it('Unite keeps the same focused point/vector lists as Separate', () => {
    const { result, engine } = run();

    const panels = () => ({
      points: engine.pointLabelPanel().entries(),
      vectors: engine.vectorLabelPanel().entries(),
      pointsVisible: engine.pointLabelPanel().isVisible(),
      vectorsVisible: engine.vectorLabelPanel().isVisible(),
    });

    const overview = panels();
    engine.toggleSelectionPresentation();
    expect(panels()).toEqual(overview);

    for (const name of ['makeBox', 'makeSimpleTube']) {
      const apiIndex = result.apiCalls.findIndex((call) => call.name === name);
      engine.setApiFocusIndices(new Set([apiIndex]));
      const focused = panels();
      expect(focused.points.length).toBeGreaterThan(0);
      for (const entry of [...focused.points, ...focused.vectors]) {
        expect(entry.id.startsWith(`@api${apiIndex}:`)).toBe(true);
      }
      engine.toggleSelectionPresentation();
      expect(panels()).toEqual(focused);
      engine.toggleSelectionPresentation();
      expect(panels()).toEqual(focused);
    }

    engine.clearApiFocus();
    expect(panels()).toEqual(overview);
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

    expect(points.selectedRowRect(pointId).isEmpty()).toBe(false);
    expect(vectors.selectedRowRect(vectorId).isEmpty()).toBe(false);

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
    const picked = pickMeshAlongRay(geometry.meshes, engine.camera().screenRay(screen)!, () => true);
    expect(picked).toBeGreaterThanOrEqual(0);
    click(engine, screen.x, screen.y);
    const pickedMesh = geometry.meshes[picked];
    expect(onMesh).toHaveBeenCalledWith(pickedMesh.apiIndex, pickedMesh.sourceLine);
    engine.setApiFocusIndices(new Set([pickedMesh.apiIndex + 100]));
    click(engine, screen.x, screen.y);
    expect(onMesh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Circular', 'Point'],
    ['Circular', 'Vector'],
    ['Circular', 'Mesh'],
    ['Rectangular', 'Point'],
    ['Rectangular', 'Vector'],
    ['Rectangular', 'Mesh'],
  ] as const)('picks %s connectors in %s mode until they are explicitly hidden', (type, mode) => {
    const { runtime, engine } = run();
    const definition = {
      ...defaultConnectorDefinition(),
      id: 3,
      name: 'c',
      pointName: 'linkPoint1',
      diameter: '100',
      type,
      aSize: '120',
      bSize: '80',
      position: ['0', '0', '600'] as [string, string, string],
    };
    const preview = buildConnectorPreview(definition, (e) => runtime.evaluateNumericExpression(e));
    engine.setConnectorPreviews([preview], -1);
    engine.setSelectionMode(mode);
    const ranges = appendConnectorVertices(new VertexArray(), [preview], -1);
    expect(ranges.vertexCount).toBeGreaterThan(0);
    expect(ranges.lineCount).toBeGreaterThan(0);
    const onConnector = vi.fn();
    engine.setConnectorSelectionCallback(onConnector);
    engine.fitScene();
    const triangle = preview.meshes[0].indices.slice(0, 3).map((index) => preview.meshes[0].vertices[index]);
    const facePoint = triangle.reduce((sum, p) => sum.add(new QVector3D(p.x, p.y, p.z)), new QVector3D()).mul(1 / 3);
    const target =
      mode === 'Point'
        ? preview.point
        : mode === 'Vector'
          ? preview.point.add(preview.direction.mul(preview.length * 1.4))
          : facePoint;
    const screen = project(engine, new QVector3D(target.x, target.y, target.z));
    click(engine, screen.x, screen.y);
    expect(onConnector).toHaveBeenCalledWith(3);
    engine.setApiFocusIndices(new Set([0]));
    click(engine, screen.x, screen.y);
    expect(onConnector).toHaveBeenCalledTimes(2);
    engine.setConnectorPreviews([], -1);
    click(engine, screen.x, screen.y);
    expect(onConnector).toHaveBeenCalledTimes(2);
  });

  it('Mesh picking compares connector surfaces with element meshes by depth', () => {
    const engine = createEngine();
    const preview = buildConnectorPreview({ ...defaultConnectorDefinition(), id: 7, diameter: '4' }, Number);
    engine.setConnectorPreviews([preview], -1);
    engine.setSelectionMode('Mesh');
    engine.fitScene();
    const triangle = preview.meshes[0].indices.slice(0, 3).map((index) => preview.meshes[0].vertices[index]);
    const target = triangle.reduce((sum, p) => sum.add(new QVector3D(p.x, p.y, p.z)), new QVector3D()).mul(1 / 3);
    const foreground = engine.camera().cameraPosition().add(target).mul(0.5);
    engine.setGeometryScene(
      scene(
        boxMesh(
          [foreground.x - 1, foreground.y - 1, foreground.z - 1],
          [foreground.x + 1, foreground.y + 1, foreground.z + 1],
          3,
        ),
      ),
    );
    const onMesh = vi.fn();
    const onConnector = vi.fn();
    engine.setMeshSelectionCallback(onMesh);
    engine.setConnectorSelectionCallback(onConnector);
    const screen = project(engine, target);
    click(engine, screen.x, screen.y);
    expect(onMesh).toHaveBeenCalledWith(3, 4);
    expect(onConnector).not.toHaveBeenCalled();
    engine.setShowGeometry(false);
    click(engine, screen.x, screen.y);
    expect(onConnector).toHaveBeenCalledWith(7);
  });

  it('shows original position expressions for every displayed Link and selects from the corner panel', () => {
    const { engine, runtime } = run();
    const previews = [1, 2].map((id) =>
      buildConnectorPreview(
        {
          ...defaultConnectorDefinition(),
          id,
          pointName: `linkPoint${id}`,
          diameter: '100',
          position: [id === 1 ? '-W/2' : 'W/2', '0', '3*W'],
        },
        (e) => runtime.evaluateNumericExpression(e),
      ),
    );
    engine.setConnectorPreviews(previews, -1);
    const panel = engine.connectorLabelPanel();
    expect(panel.isVisible()).toBe(false);
    expect(previews[0].point).toMatchObject({ x: -100, y: 0, z: 600 });
    engine.setConnectorPreviews(previews, 1);
    expect(panel.isVisible()).toBe(true);
    expect(panel.entries()).toEqual([
      {
        id: '1',
        name: 'linkPoint1',
        value: '(-100, 0, 600)',
        details: [
          { name: 'X', value: '-W/2' },
          { name: 'Y', value: '0' },
          { name: 'Z', value: '3*W' },
        ],
      },
      {
        id: '2',
        name: 'linkPoint2',
        value: '(100, 0, 600)',
        details: [
          { name: 'X', value: 'W/2' },
          { name: 'Y', value: '0' },
          { name: 'Z', value: '3*W' },
        ],
      },
    ]);
    expect(panel.isRowSelected(0)).toBe(true);
    const onConnector = vi.fn((id: number) => engine.setConnectorPreviews(previews, id));
    engine.setConnectorSelectionCallback(onConnector);
    panel.mousePressEvent(20, panel.rowHeight() * 1.5, LeftButton, NoModifier);
    panel.mouseReleaseEvent(20, panel.rowHeight() * 1.5, LeftButton, NoModifier);
    expect(onConnector).toHaveBeenCalledWith(2);
    expect(panel.isRowSelected(1)).toBe(true);
    expect(panel.headerText()).toBe('Links  (2)');
    expect(panel.geometry().width).toBeGreaterThan(440);
    expect(panel.geometry().height).toBe(panel.contentHeight());
    expect(panel.getSnapshot().rows.map((row) => [row.nameText, row.valueText])).toEqual([
      ['linkPoint1', '(-100, 0, 600)'],
      ['linkPoint2', '(100, 0, 600)'],
      ['X', 'W/2'],
      ['Y', '0'],
      ['Z', '3*W'],
    ]);
    panel.keyPressEvent('Enter', NoModifier);
    expect(panel.getSnapshot().rows).toHaveLength(2);
    expect(panel.geometry().height).toBe(panel.contentHeight());
    engine.setConnectorPreviews(previews, -1);
    expect(panel.isVisible()).toBe(false);
    expect(engine.pointLabelPanel().isVisible()).toBe(true);
  });
});

import { apiDebugItemId } from '@/entities/api-call';
import { NoModifier } from '@/shared/lib/qt';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import { buildConnectorPreview, defaultConnectorDefinition, PreviewGeometryEngine } from '@engine/geometry';
import { GeometryRuntime } from '@engine/runtime';
import { fakeSurface } from '@tests/renderer/recordingBackend';
import { project } from '@tests/renderer/helpers';

const kSource = `
FdPoint3d ends[2] = {FdPoint3d(0, 0, 0), FdPoint3d(0, 0, 200)};
FdVector3d directions[2] = {vz, vz};
makeBox(1, ends, directions, 50, 30);
makeDisc(FdPoint3d(300, 0, 0), FdVector3d(0, 0, 1), 60, 20, 16, false);
makeDisc(FdPoint3d(-300, 0, 0), FdVector3d(1, 0, 0), 80, 0, 16, false);`;

// Paints the same scene in several states and returns the name of each painted state, in order.
// Each paint is one animation frame, so each is one frame on the engine's backend.
export function playDrawScenarios(engine: ViewportEngine): string[] {
  const names: string[] = [];
  const pending: FrameRequestCallback[] = [];
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => pending.push(callback);

  const paint = (name: string) => {
    engine.update();
    for (const callback of pending.splice(0)) callback(0);
    names.push(name);
  };

  try {
    play(engine, paint);
  } finally {
    globalThis.requestAnimationFrame = original;
  }

  return names;
}

function play(engine: ViewportEngine, paint: (name: string) => void): void {
  const runtime = new GeometryRuntime();
  const result = runtime.executeUpToLine(kSource, 999, true);
  const scene = new PreviewGeometryEngine().build(result);
  engine.attach(fakeSurface());
  engine.resize(800, 600, 1);
  engine.setGeometryScene(scene);
  engine.setRuntimeResult(result);
  engine.fitScene();
  paint('scene');

  engine.setSelectedApiCall(1);
  paint('api selected');

  engine.toggleSelectionPresentation();
  paint('unite');
  engine.toggleSelectionPresentation();

  engine.setGeometryWireframe(true);
  paint('wireframe');
  engine.setGeometryWireframe(false);

  engine.setApiFocusIndices(new Set([1]));
  paint('api focus with vectors');
  engine.setSelectedVariable(apiDebugItemId(1, 'vector', 'normal'));
  paint('selected vector');
  engine.setSelectedVariable('');
  engine.clearApiFocus();
  engine.setSelectedApiCall(-1);

  const connector = buildConnectorPreview(
    { ...defaultConnectorDefinition(), id: 3, name: 'c', pointName: 'linkPoint1', diameter: '100' },
    (expression) => runtime.evaluateNumericExpression(expression),
  );
  engine.setConnectorPreviews([connector], 3);
  paint('connectors');
  engine.setConnectorPreviews([], -1);

  engine.selectionModeButtonClicked();
  engine.selectionModeButtonClicked();
  const [first] = scene.meshes;
  const corners = first.indices.slice(0, 3).map((index) => first.vertices[index]);
  const centroid = corners.reduce((sum, v) => sum.add(new QVector3D(v.x, v.y, v.z)), new QVector3D()).div(3);
  const screen = project(engine, centroid);
  engine.mouseMoveEvent({ x: screen.x, y: screen.y, button: 0, buttons: 0, modifiers: NoModifier });
  paint('hovered mesh');
}

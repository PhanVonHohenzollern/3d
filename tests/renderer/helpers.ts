import type { PreviewMesh, PreviewGeometryScene } from '../../src/core/geometry/PreviewGeometryEngine';
import { emptyRuntimeResult, type RuntimeResult } from '../../src/core/runtime/RuntimeTypes';
import { FdPoint3d } from '../../src/core/runtime/FdMath';
import { DebugItem } from '../../src/core/viewport/DebugItem';
import { ViewportEngine } from '../../src/core/viewport/ViewportEngine';
import type { TextMeasurer } from '../../src/types/text';
import type { QPointF, QVector3D } from '../../src/utils/Vector3D';

export const fixedMeasurer: TextMeasurer = {
  horizontalAdvance: (text) => Array.from(text).length * 7,
  ascent: () => 10,
  descent: () => 3,
};

export function boxMesh(
  min: [number, number, number],
  max: [number, number, number],
  apiIndex = 0,
  apiName = 'makeBox',
): PreviewMesh {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const p = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  const indices: number[] = [];
  for (const [a, b, c, d] of quads) indices.push(a, b, c, a, c, d);

  return {
    apiIndex,
    sourceLine: apiIndex + 1,
    apiName,
    color: { r: 1, g: Math.fround(176 / 255), b: 0 },
    vertices: p.map(([x, y, z]) => ({ x, y, z, nx: 0, ny: 0, nz: 0 })),
    indices,
  };
}

export function scene(...meshes: PreviewMesh[]): PreviewGeometryScene {
  return { meshes, warnings: [] };
}

export function resultWithP0(x: number, y: number, z: number): RuntimeResult {
  const result = emptyRuntimeResult();
  result.variables.push({ name: 'p0', value: new FdPoint3d(x, y, z), lastChangedLine: 1 });

  return result;
}

export function createEngine(width = 800, height = 600): ViewportEngine {
  const engine = new ViewportEngine();
  engine.setTextMeasurer(fixedMeasurer);
  engine.resize(width, height, 1);

  return engine;
}

export function updateCamera(engine: ViewportEngine) {
  const camera = engine.camera();
  camera.updateViewMatrix();
  camera.updateProjectionMatrix(engine.sceneScale());

  return camera;
}

export function project(engine: ViewportEngine, p: QVector3D): QPointF {
  const screen = updateCamera(engine).projectToScreen(p);
  if (!screen) throw new Error('point does not project');

  return screen;
}

export function vectorItem(name: string, start: QVector3D, end: QVector3D, apiIndex = 0): DebugItem {
  const item = new DebugItem();
  item.kind = 'Vector';
  item.name = name;
  item.apiIndex = apiIndex;
  item.apiSnapshot = true;
  item.start = start;
  item.end = end;

  return item;
}

export function mouse(
  x: number,
  y: number,
  button: number,
  buttons: number,
  modifiers: Partial<{ control: boolean; shift: boolean; alt: boolean }> = {},
) {
  return { x, y, button, buttons, modifiers: { control: false, shift: false, alt: false, ...modifiers } };
}

export function click(
  engine: ViewportEngine,
  x: number,
  y: number,
  modifiers: Partial<{ control: boolean; shift: boolean; alt: boolean }> = {},
) {
  engine.mousePressEvent(mouse(x, y, 1, 1, modifiers));
  engine.mouseReleaseEvent(mouse(x, y, 1, 0, modifiers));
}

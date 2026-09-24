// Shared fixtures for the renderer unit tests (headless: no DOM, no WebGL).

import type { PreviewMesh, PreviewGeometryScene } from '../../src/geometry/PreviewGeometryEngine';
import { emptyRuntimeResult, type RuntimeResult } from '../../src/runtime/RuntimeTypes';
import { FdPoint3d } from '../../src/runtime/FdMath';
import type { TextMeasurer } from '../../src/renderer/TextMetrics';
import { ViewportEngine } from '../../src/renderer/ViewportEngine';
import type { QPointF, QVector3D } from '../../src/renderer/Vector3D';

/** Every character is 7 px wide; ascent 10, descent 3 (QFontMetrics height 13). */
export const fixedMeasurer: TextMeasurer = {
  horizontalAdvance: (text) => Array.from(text).length * 7,
  ascent: () => 10,
  descent: () => 3,
};

/** Axis-aligned box [min, max] as 12 outward-facing triangles. */
export function boxMesh(min: [number, number, number], max: [number, number, number], apiIndex = 0, apiName = 'makeBox'): PreviewMesh {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const p = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const quads = [
    [0, 3, 2, 1], // bottom (-z)
    [4, 5, 6, 7], // top (+z)
    [0, 1, 5, 4], // -y
    [1, 2, 6, 5], // +x
    [2, 3, 7, 6], // +y
    [3, 0, 4, 7], // -x
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

/** Access to the ported private members (tests only). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function internals(engine: ViewportEngine): any {
  const e = engine as any;
  return new Proxy(e, {
    get(target, key) {
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

export function project(engine: ViewportEngine, p: QVector3D): QPointF {
  const i = internals(engine);
  i.updateViewMatrix();
  i.updateProjectionMatrix();
  const screen = i.projectToScreen(p);
  if (!screen) throw new Error('point does not project');
  return screen;
}

export function mouse(x: number, y: number, button: number, buttons: number, modifiers: Partial<{ control: boolean; shift: boolean; alt: boolean }> = {}) {
  return { x, y, button, buttons, modifiers: { control: false, shift: false, alt: false, ...modifiers } };
}

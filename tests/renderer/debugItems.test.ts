import { describe, expect, it } from 'vitest';
import { FdPoint3d, FdVector3d } from '../../src/core/runtime/FdMath';
import { runtimeValueToCompactString } from '../../src/core/runtime/RuntimeValue';
import { appendVectorArrow } from '../../src/core/viewport/debugItems';
import { VertexArray } from '../../src/core/viewport/VertexArray';
import { debugValueText } from '../../src/helpers/debugValueText';
import { QVector3D } from '../../src/utils/Vector3D';
import { createEngine, updateCamera, vectorItem } from './helpers';

function arrowFor(start: QVector3D, end: QVector3D) {
  const engine = createEngine();
  const eye = updateCamera(engine).cameraPosition();
  const vertices = new VertexArray();
  appendVectorArrow(vertices, vectorItem('v', start, end), false, eye, engine.sceneScale());

  return { eye, vertices };
}

describe('vector arrows', () => {
  it('is one shaft plus a camera-facing V head', () => {
    const start = new QVector3D(1, 1, 0);
    const end = new QVector3D(1, 1, 5);
    const { eye, vertices } = arrowFor(start, end);
    expect(vertices.size()).toBe(6);
    expect(vertices.position(0)).toEqual(start);
    expect(vertices.position(1)).toEqual(end);
    expect(vertices.position(2)).toEqual(end);
    expect(vertices.position(4)).toEqual(end);

    const headLength = 0.5;
    const wing = headLength * 0.52;
    const w1 = vertices.position(3);
    const w2 = vertices.position(5);
    const base = end.sub(new QVector3D(0, 0, headLength));
    expect(w1.add(w2).mul(0.5).sub(base).length()).toBeLessThan(1e-6);
    expect(w1.sub(base).length()).toBeCloseTo(wing, 6);
    const side = w1.sub(base).normalized();
    expect(QVector3D.dotProduct(side, new QVector3D(0, 0, 1))).toBeCloseTo(0, 6);
    expect(QVector3D.dotProduct(side, eye.sub(end).normalized())).toBeCloseTo(0, 6);
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
    expect(new QVector3D(0.2, 0, 0).sub(base).length()).toBeCloseTo(0.12, 6);
  });
});

describe('debug values', () => {
  it('uses inspector precision without scientific notation for small coordinates', () => {
    expect(debugValueText({ x: 1.23153e-10, y: 210, z: 0 })).toBe('(0, 210, 0)');
    expect(debugValueText({ x: 1.225665e-10, y: 209, z: 0 })).toBe('(0, 209, 0)');
    expect(debugValueText({ x: 12345678, y: 1e-5, z: 2.5 })).toBe('(12345678, 0.00001, 2.5)');
  });

  it('matches inspector formatting for points and vectors without mutating coordinates', () => {
    for (const value of [new FdPoint3d(0.1 + 0.2, 1234567.8, -1e-10), new FdVector3d(1.23456789, -2.5, 0)]) {
      const original = { x: value.x, y: value.y, z: value.z };
      expect(debugValueText(value)).toBe(runtimeValueToCompactString(value));
      expect({ x: value.x, y: value.y, z: value.z }).toEqual(original);
    }
  });
});

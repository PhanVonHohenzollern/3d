import { describe, expect, it } from 'vitest';
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
  it("formats debug values like QString::arg(x, 0, 'g', 7)", () => {
    expect(debugValueText({ x: 0.1 + 0.2, y: 1234567.8, z: 0 })).toBe('(0.3, 1234568, 0)');
    expect(debugValueText({ x: 12345678, y: 1e-5, z: 2.5 })).toBe('(1.234568e+07, 1e-05, 2.5)');
  });
});

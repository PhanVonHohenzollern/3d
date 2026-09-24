import { describe, expect, it } from 'vitest';
import type { DebugItem } from '../../src/core/viewport/DebugItem';
import { appendVectorArrow } from '../../src/core/viewport/debugItems';
import { pickDebugItemAt, pickMeshAlongRay } from '../../src/core/viewport/picking';
import { VertexArray } from '../../src/core/viewport/VertexArray';
import type { ViewportEngine } from '../../src/core/viewport/ViewportEngine';
import type { PreviewMesh } from '../../src/core/geometry/PreviewGeometryEngine';
import { QPointF, QVector3D } from '../../src/utils/Vector3D';
import { boxMesh, createEngine, project, updateCamera, vectorItem } from './helpers';

const everything = () => true;

function pickMesh(engine: ViewportEngine, meshes: PreviewMesh[], screen: QPointF): number {
  const ray = updateCamera(engine).screenRay(screen);

  return ray ? pickMeshAlongRay(meshes, ray, everything) : -1;
}

function pickItem(engine: ViewportEngine, items: DebugItem[], kind: 'Point' | 'Vector', screen: QPointF): string {
  const camera = updateCamera(engine);
  const eye = camera.cameraPosition();

  const arrow = (item: DebugItem) => {
    const vertices = new VertexArray(8);
    appendVectorArrow(vertices, item, false, eye, engine.sceneScale());

    return vertices;
  };

  return pickDebugItemAt(items, kind, screen, eye, everything, (p) => camera.projectToScreen(p), arrow);
}

describe('mesh picking', () => {
  it('intersects actual triangles and keeps the nearest hit', () => {
    const engine = createEngine();
    const meshes = [boxMesh([-1, -1, -1], [1, 1, 1], 0), boxMesh([-0.5, -0.5, 4], [0.5, 0.5, 5], 1)];
    expect(pickMesh(engine, meshes, new QPointF(400, 300))).toBe(0);
    expect(pickMesh(engine, meshes, new QPointF(5, 5))).toBe(-1);
    expect(pickMesh(engine, meshes, project(engine, new QVector3D(0, 0, 4.5)))).toBe(1);
  });

  it('prefers the triangle closest to the camera', () => {
    const engine = createEngine();
    const toward = updateCamera(engine).cameraPosition().normalized().mul(4);
    const nearBox = boxMesh(
      [toward.x - 0.5, toward.y - 0.5, toward.z - 0.5],
      [toward.x + 0.5, toward.y + 0.5, toward.z + 0.5],
      7,
    );
    expect(pickMesh(engine, [boxMesh([-1, -1, -1], [1, 1, 1], 3), nearBox], project(engine, toward))).toBe(1);
  });

  it('skips meshes whose API is filtered out', () => {
    const engine = createEngine();
    const ray = updateCamera(engine).screenRay(new QPointF(400, 300))!;
    const meshes = [boxMesh([-1, -1, -1], [1, 1, 1], 0)];
    expect(pickMeshAlongRay(meshes, ray, (apiIndex) => apiIndex === 5)).toBe(-1);
    expect(pickMeshAlongRay(meshes, ray, (apiIndex) => apiIndex === 0)).toBe(0);
  });
});

describe('debug item snapping', () => {
  it('snaps points within 18 logical pixels and never falls through to vectors', () => {
    const engine = createEngine();
    const point = vectorItem('p', new QVector3D(1, 2, 0.5), new QVector3D(1, 2, 0.5));
    point.kind = 'Point';
    const screen = project(engine, point.end);
    expect(pickItem(engine, [point], 'Point', new QPointF(screen.x + 17.5, screen.y))).toBe('p');
    expect(pickItem(engine, [point], 'Point', new QPointF(screen.x + 18.5, screen.y))).toBe('');
    expect(pickItem(engine, [point], 'Vector', screen)).toBe('');
  });

  it('snaps vectors within 12 pixels of the shaft or head', () => {
    const engine = createEngine();
    const item = vectorItem('@api0:vector:normal', new QVector3D(0, 0, 0), new QVector3D(0, 0, 4));
    const a = project(engine, item.start);
    const b = project(engine, new QVector3D(0, 0, 2));
    const mid = new QPointF((a.x + b.x) / 2, (a.y + b.y) / 2);
    expect(pickItem(engine, [item], 'Vector', new QPointF(mid.x + 11, mid.y))).toBe(item.name);
    expect(pickItem(engine, [item], 'Vector', new QPointF(mid.x + 13, mid.y))).toBe('');
  });
});

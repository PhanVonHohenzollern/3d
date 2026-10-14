import { describe, expect, it, vi } from 'vitest';
import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { QPoint, QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import type { PreviewMesh } from '@engine/geometry';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { activeNavigationView, navigationViews, projectViewCube } from '@/widgets/viewport/lib/render/viewCube';
import { boxMesh, createEngine, mouse, scene, updateCamera } from '@tests/renderer/helpers';

const directions: QVector3D[] = [];
for (const x of [-1, 0, 1])
  for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) directions.push(new QVector3D(x, y, z));

function expectMeshInsideFrame(engine: ViewportEngine, mesh: PreviewMesh): void {
  const camera = updateCamera(engine);
  for (const vertex of mesh.vertices) {
    const point = camera.projectToScreen(new QVector3D(vertex.x, vertex.y, vertex.z));
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(engine.width() * 0.04);
    expect(point!.x).toBeLessThan(engine.width() * 0.96);
    expect(point!.y).toBeGreaterThan(engine.height() * 0.04);
    expect(point!.y).toBeLessThan(engine.height() * 0.96);
  }
}

describe('ViewCube camera directions', () => {
  it.each([
    [1200, 400],
    [400, 1200],
    [600, 600],
  ])('refits panned/zoomed geometry for every view in a %s × %s viewport', (width, height) => {
    const engine = createEngine(width, height);
    const mesh = boxMesh([-800, 170, -60], [800, 200, 200]);
    engine.setGeometryScene(scene(mesh));
    engine.setSelectedApiCall(0);
    engine.setApiFocusIndices(new Set([0]));
    for (const direction of directions) {
      engine.camera().target = new QVector3D(10000, 20000, -5000);
      engine.camera().distance = 1;
      engine.setViewDirection(direction);
      expect(engine.camera().target).toEqual(new QVector3D(0, 185, 70));
      expectMeshInsideFrame(engine, mesh);
      expect(engine.hasApiFocus()).toBe(true);
    }
    engine.homeView();
    expectMeshInsideFrame(engine, mesh);
  });

  it('supports all 26 faces, edges and corners, including both poles', () => {
    const engine = createEngine();
    const camera = engine.camera();
    camera.target = new QVector3D(5, 8, -2);
    camera.distance = 35;
    const target = camera.target;
    for (const direction of directions) {
      engine.setViewDirection(direction);
      updateCamera(engine);
      const actual = camera.cameraPosition().sub(target).normalized();
      expect(actual.sub(direction.normalized()).length()).toBeLessThan(1e-8);
      expect(QVector3D.dotProduct(actual, camera.upDirection())).toBeCloseTo(0, 8);
      expect(camera.target).toBe(target);
      expect(camera.distance).toBe(35);
      expect([...camera.view.data].every(Number.isFinite)).toBe(true);
      const faces = projectViewCube(camera.orientation);
      expect(faces).toHaveLength([direction.x, direction.y, direction.z].filter(Boolean).length);
      for (const face of faces) expect(face.points).not.toMatch(/NaN|Infinity/);
    }
  });

  it('maps the outer ring to four elevations and four isometric views, with Top/Bottom inside', () => {
    const engine = createEngine();
    expect(navigationViews.map(({ name, direction }) => [name, direction.x, direction.y, direction.z])).toEqual([
      ['Back', 0, 1, 0],
      ['NE Isometric', 1, 1, 1],
      ['Right', 1, 0, 0],
      ['SE Isometric', 1, -1, 1],
      ['Front', 0, -1, 0],
      ['SW Isometric', -1, -1, 1],
      ['Left', -1, 0, 0],
      ['NW Isometric', -1, 1, 1],
      ['Top', 0, 0, 1],
      ['Bottom', 0, 0, -1],
    ]);
    for (const view of navigationViews) {
      engine.setViewDirection(view.direction);
      const camera = engine.camera();
      expect(
        camera.cameraPosition().sub(camera.target).normalized().sub(view.direction.normalized()).length(),
      ).toBeLessThan(1e-8);
      expect(activeNavigationView(camera.orientation)).toBe(view.name);
      if (view.direction.z === 0) expect(camera.upDirection().z).toBeCloseTo(1);
      else if (view.direction.x !== 0) expect(camera.upDirection().z).toBeCloseTo(Math.sqrt(2 / 3));
    }
  });

  it.each(navigationViews)('keeps $name selected through Pan/Zoom, but clears it on Orbit or Roll', (view) => {
    const engine = createEngine();
    const camera = engine.camera();
    engine.setViewDirection(view.direction);
    camera.pan(new QPoint(15, -20));
    camera.zoom(120);
    expect(activeNavigationView(camera.orientation)).toBe(view.name);
    const q = camera.orientation;
    expect(activeNavigationView(new Quaternion(-q.x, -q.y, -q.z, -q.w))).toBe(view.name);
    camera.orbit(new QPoint(5, 0));
    expect(activeNavigationView(camera.orientation)).toBeNull();
    engine.setViewDirection(view.direction);
    engine.rollView(Math.PI / 6);
    expect(activeNavigationView(camera.orientation)).toBeNull();
    engine.homeView();
    expect(activeNavigationView(camera.orientation)).toBeNull();
  });

  it.each([
    [1200, 400],
    [400, 1200],
  ])('fits all ten presets with angle-dependent zoom in a %s × %s viewport', (width, height) => {
    const engine = createEngine(width, height);
    const mesh = boxMesh([-800, -30, -100], [800, 30, 100]);
    engine.setGeometryScene(scene(mesh));
    const distances = new Map<string, number>();
    for (const view of navigationViews) {
      engine.camera().target = new QVector3D(10000, 20000, -5000);
      engine.camera().distance = 1;
      engine.setViewDirection(view.direction);
      expect(engine.camera().target).toEqual(new QVector3D(0, 0, 0));
      expectMeshInsideFrame(engine, mesh);
      distances.set(view.name, engine.camera().distance);
    }
    expect(distances.get('Front')).not.toBeCloseTo(distances.get('Right')!);
    expect(distances.get('SE Isometric')).not.toBeCloseTo(distances.get('Front')!);
  });

  it('rolls around the viewing axis and Home restores orientation and fits the model', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([10, 20, 30], [20, 30, 40])));
    engine.setViewDirection(new QVector3D(0, -1, 0));
    const camera = engine.camera();
    const position = camera.cameraPosition();
    engine.rollView(Math.PI / 2);
    expect(camera.cameraPosition().sub(position).length()).toBeLessThan(1e-8);
    expect(
      camera
        .upDirection()
        .sub(new QVector3D(-1, 0, 0))
        .length(),
    ).toBeLessThan(1e-8);
    engine.homeView();
    expect(camera.orientation).toEqual(ViewportCamera.homeOrientation());
    expect(camera.target).toEqual(new QVector3D(15, 25, 35));
    expect(camera.distance).toBeGreaterThan(18);
  });

  it('animates by the shortest rotation and stops immediately on viewport input', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let serial = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++serial, callback);

      return serial;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    try {
      const engine = createEngine(320, 900);
      const mesh = boxMesh([-2000, -400, -100], [400, 100, 300]);
      engine.setGeometryScene(scene(mesh));
      const initial = engine.cameraOrientation();
      const started = performance.now();
      engine.setViewDirection(new QVector3D(0, 0, -1));
      expect(engine.cameraOrientation()).toBe(initial);
      const callback = frames.get(1)!;
      frames.delete(1);
      callback(started + 90);
      expect(engine.cameraOrientation()).not.toEqual(initial);
      expect(Math.hypot(...Object.values(engine.cameraOrientation()))).toBeCloseTo(1, 8);
      expectMeshInsideFrame(engine, mesh);
      engine.mousePressEvent(mouse(400, 300, 1, 1));
      expect(frames.size).toBe(0);
      engine.detach();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fits immediately when reduced motion is enabled', () => {
    const frame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', frame);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    try {
      const engine = createEngine(300, 900);
      const mesh = boxMesh([-1000, -50, -10], [1000, 50, 10]);
      engine.setGeometryScene(scene(mesh));
      engine.setViewDirection(new QVector3D(0, -1, 0));
      expectMeshInsideFrame(engine, mesh);
      expect(frame).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('interpolates equivalent quaternion signs without flipping', () => {
    const q = ViewportCamera.homeOrientation();
    const negative = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    expect(q.slerp(negative, 0.5).rotate(new QVector3D(0, 0, 1))).toEqual(q.rotate(new QVector3D(0, 0, 1)));
  });
});

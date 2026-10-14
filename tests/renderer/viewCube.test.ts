import { describe, expect, it, vi } from 'vitest';
import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { QPoint, QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import type { PreviewMesh } from '@engine/geometry';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { activeNavigationView, navigationViews, projectViewCube } from '@/widgets/viewport/lib/render/viewCube';
import { pickMeshAlongRay } from '@/widgets/viewport/lib/render/picking';
import { boxMesh, createEngine, mouse, scene, updateCamera } from '@tests/renderer/helpers';

const directions: QVector3D[] = [];
for (const x of [-1, 0, 1])
  for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) directions.push(new QVector3D(x, y, z));

function expectMeshInsideFrame(engine: ViewportEngine, mesh: PreviewMesh): void {
  const camera = updateCamera(engine);
  for (const vertex of mesh.vertices) {
    const point = camera.projectToScreen(new QVector3D(vertex.x, vertex.y, vertex.z));
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(engine.width() * 0.18);
    expect(point!.x).toBeLessThan(engine.width() * 0.82);
    expect(point!.y).toBeGreaterThan(engine.height() * 0.18);
    expect(point!.y).toBeLessThan(engine.height() * 0.82);
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
    const viewHeights = new Map<string, number>();
    for (const view of navigationViews) {
      engine.camera().target = new QVector3D(10000, 20000, -5000);
      engine.camera().setProjectionMode('perspective');
      engine.camera().distance = 1;
      engine.camera().orthographicHeight = 1;
      engine.setViewDirection(view.direction);
      expect(engine.camera().target).toEqual(new QVector3D(0, 0, 0));
      expectMeshInsideFrame(engine, mesh);
      viewHeights.set(view.name, engine.camera().viewHeight());
    }
    expect(viewHeights.get('Front')).not.toBeCloseTo(viewHeights.get('Right')!);
    expect(viewHeights.get('SE Isometric')).not.toBeCloseTo(viewHeights.get('Front')!);
  });

  it.each(['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'])(
    '%s projects onto one plane without perspective, including after Pan/Zoom',
    (name) => {
      const engine = createEngine();
      const mesh = boxMesh([80, 180, 280], [120, 220, 320]);
      engine.setGeometryScene(scene(mesh));
      const view = navigationViews.find((view) => view.name === name)!;
      engine.setViewDirection(view.direction);
      const camera = engine.camera();
      const center = camera.target;
      const across = camera.orientation.rotate(new QVector3D(5, 7, 0));
      const point = center.add(across);
      for (let pass = 0; pass < 2; pass++) {
        updateCamera(engine);
        const front = camera.projectToScreen(point.add(view.direction.mul(10)))!;
        const back = camera.projectToScreen(point.sub(view.direction.mul(10)))!;
        expect(front).not.toBeNull();
        expect(back).not.toBeNull();
        // Opposite box faces and the depth axis must collapse to the same 2D plane.
        expect(front.x).toBeCloseTo(back.x, 4);
        expect(front.y).toBeCloseTo(back.y, 4);
        const ray = camera.screenRay(front)!;
        const centerRay = camera.screenRay(camera.projectToScreen(center)!)!;
        expect(
          ray.farPoint
            .sub(ray.nearPoint)
            .normalized()
            .sub(centerRay.farPoint.sub(centerRay.nearPoint).normalized())
            .length(),
        ).toBeLessThan(1e-5);
        expect(pickMeshAlongRay([mesh], ray, () => true)).toBe(0);
        camera.pan(new QPoint(30, -15));
        camera.zoom(120);
      }
    },
  );

  it('restores perspective for diagonal views and Home after a flat elevation', () => {
    const engine = createEngine();
    const mesh = boxMesh([-30, -20, -10], [30, 20, 10]);
    engine.setGeometryScene(scene(mesh));
    for (const view of navigationViews.filter((view) => view.name.includes('Isometric'))) {
      engine.setViewDirection(new QVector3D(0, -1, 0));
      expect(updateCamera(engine).projection.get(3, 2)).toBe(0);
      engine.setViewDirection(view.direction);
      expect(updateCamera(engine).projection.get(3, 2)).toBe(-1);
      expectMeshInsideFrame(engine, mesh);
    }
    engine.setViewDirection(new QVector3D(0, 0, -1));
    engine.homeView();
    expect(updateCamera(engine).projection.get(3, 2)).toBe(-1);
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
      callback(started + 260);
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

  it.each([
    [1200, 400],
    [400, 1200],
  ])('only zooms outward throughout all presets in a %s × %s viewport', (width, height) => {
    const frames = new Map<number, FrameRequestCallback>();
    let serial = 0,
      now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++serial, callback);

      return serial;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    const engine = createEngine(width, height);
    try {
      const mesh = boxMesh([-2000, -400, -100], [400, 100, 300]);
      engine.setGeometryScene(scene(mesh));
      for (const view of navigationViews) {
        const camera = engine.camera();
        let height = camera.viewHeight();
        engine.setViewDirection(view.direction);
        // Switching back from orthographic must not reuse its shorter eye distance.
        expect(camera.viewHeight()).toBeCloseTo(height, 8);
        for (const elapsed of [0, 40, 100, 150, 200, 300, 400, 500]) {
          const [id, callback] = [...frames][0];
          frames.delete(id);
          callback(now + elapsed);
          expect(camera.viewHeight()).toBeGreaterThanOrEqual(height - 1e-8);
          height = camera.viewHeight();
          if (elapsed >= 150) expectMeshInsideFrame(engine, mesh);
        }
        expect(frames.size).toBe(0);
        expect(activeNavigationView(camera.orientation)).toBe(view.name);
        now += 1000;
      }
    } finally {
      engine.detach();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it('interpolates equivalent quaternion signs without flipping', () => {
    const q = ViewportCamera.homeOrientation();
    const negative = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    expect(q.slerp(negative, 0.5).rotate(new QVector3D(0, 0, 1))).toEqual(q.rotate(new QVector3D(0, 0, 1)));
  });
});

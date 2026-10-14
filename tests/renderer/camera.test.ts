import { describe, expect, it } from 'vitest';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { QPoint, QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { boxMesh, createEngine, project, scene, updateCamera } from '@tests/renderer/helpers';

describe('ViewportCamera', () => {
  it('projects the camera target to the viewport center', () => {
    const engine = createEngine(800, 600);
    const center = project(engine, new QVector3D(0, 0, 0));
    expect(center.x).toBeCloseTo(400, 3);
    expect(center.y).toBeCloseTo(300, 3);
  });

  it('uses a 45 degree vertical field of view with the widget aspect ratio', () => {
    const camera = updateCamera(createEngine(800, 600));
    const f = 1 / Math.tan((22.5 * Math.PI) / 180);
    expect(camera.projection.get(1, 1)).toBeCloseTo(f, 5);
    expect(camera.projection.get(0, 0)).toBeCloseTo(f / (800 / 600), 5);
    const near = 18 * 0.001;
    const far = Math.max(1000, 18 + 60, near * 1000);
    expect(camera.projection.get(2, 3)).toBeCloseTo(-(2 * near * far) / (far - near), 5);
  });

  it('screenRay() passes through the projected point', () => {
    const engine = createEngine(640, 480);
    const world = new QVector3D(2, -3, 1.5);
    const ray = engine.camera().screenRay(project(engine, world))!;
    const direction = ray.farPoint.sub(ray.nearPoint);
    const t = QVector3D.dotProduct(world.sub(ray.nearPoint), direction) / direction.lengthSquared();
    const closest = ray.nearPoint.add(direction.mul(t));
    expect(closest.sub(world).length()).toBeLessThan(1e-3);
  });

  it('screenToGroundPlane() returns the clicked z = 0 point', () => {
    const engine = createEngine(800, 600);
    const ground = new QVector3D(3.25, -1.5, 0);
    const hit = engine.camera().screenToGroundPlane(project(engine, ground))!;
    expect(hit.x).toBeCloseTo(ground.x, 2);
    expect(hit.y).toBeCloseTo(ground.y, 2);
    expect(hit.z).toBe(0);
  });

  it('does not project points behind the camera', () => {
    const camera = updateCamera(createEngine(800, 600));
    const eye = camera.cameraPosition();
    const behind = eye.add(eye.sub(new QVector3D()).normalized().mul(5));
    expect(camera.projectToScreen(behind)).toBeNull();
  });

  it('orbits through the poles, upside down, and back without clamping or changing the target', () => {
    const camera = new ViewportCamera();
    camera.setViewportSize(800, 600);
    camera.orientation = Quaternion.lookingFrom(new QVector3D(0, -1, 0));
    const initial = camera.cameraPosition();
    const delta = new QPoint(0, -100);
    const positions = [];
    const upDirections = [];
    for (let i = 0; i < 12; i++) {
      camera.orbit(delta);
      camera.updateViewMatrix();
      positions.push(camera.cameraPosition());
      upDirections.push(camera.upDirection());
      expect([...camera.view.data].every(Number.isFinite)).toBe(true);
      expect(camera.cameraPosition().length()).toBeCloseTo(18, 8);
    }
    expect(positions.some((p) => p.y > 10)).toBe(true);
    expect(positions.some((p) => p.z < -10)).toBe(true);
    expect(upDirections.some((up) => up.z < -0.99)).toBe(true);
    expect(camera.cameraPosition().sub(initial).length()).toBeLessThan(1e-8);
    for (let i = 0; i < 12; i++) camera.orbit(new QPoint(0, 100));
    expect(camera.cameraPosition().sub(initial).length()).toBeLessThan(1e-8);
    expect(camera.target.length()).toBe(0);
  });

  it.each([new QVector3D(0, 0, 1), new QVector3D(0, 0, -1)])(
    'allows horizontal and vertical rotation from a pole without singularities',
    (direction) => {
      for (const delta of [new QPoint(80, 0), new QPoint(0, 80), new QPoint(80, 80)]) {
        const camera = new ViewportCamera();
        camera.setViewportSize(800, 600);
        camera.orientation = Quaternion.lookingFrom(direction);
        const initial = camera.cameraPosition();
        const up = camera.upDirection();
        camera.orbit(delta);
        camera.updateViewMatrix();
        expect(camera.cameraPosition().sub(initial).length()).toBeGreaterThan(1);
        expect([...camera.view.data].every(Number.isFinite)).toBe(true);
        camera.orbit(new QPoint(-delta.x, -delta.y));
        expect(camera.cameraPosition().sub(initial).length()).toBeLessThan(1e-8);
        expect(camera.upDirection().sub(up).length()).toBeLessThan(1e-8);
      }
    },
  );

  it('keeps horizontal drag relative to the screen after flipping upside down', () => {
    const camera = new ViewportCamera();
    camera.setViewportSize(800, 600);
    camera.orientation = Quaternion.lookingFrom(new QVector3D(0, -1, 0));
    camera.orbit(new QPoint(0, 600));
    expect(camera.upDirection().z).toBeCloseTo(-1, 8);
    const initial = camera.cameraPosition();
    const right = camera.orientation.rotate(new QVector3D(1, 0, 0));
    camera.orbit(new QPoint(80, 0));
    expect(QVector3D.dotProduct(camera.cameraPosition().sub(initial), right)).toBeLessThan(0);
    expect(camera.upDirection().z).toBeCloseTo(-1, 8);
  });

  it('pans in the screen plane after camera roll', () => {
    const camera = new ViewportCamera();
    camera.orientation = Quaternion.axisAngle(new QVector3D(0, 0, 1), Math.PI / 2);
    camera.pan(new QPoint(10, 20));
    expect(camera.target.x).toBeCloseTo(-20 * 18 * 0.0018);
    expect(camera.target.y).toBeCloseTo(-10 * 18 * 0.0018);
    expect(camera.target.z).toBeCloseTo(0);
  });

  it('zooms by 0.86 per wheel notch within its guard band', () => {
    const camera = new ViewportCamera();
    camera.zoom(120);
    expect(camera.distance).toBeCloseTo(18 * 0.86, 9);
    camera.zoom(-120 * 400);
    expect(camera.distance).toBe(1.0e8);
  });

  it('pans in pixels and zooms the orthographic span independently of clipping distance', () => {
    const engine = createEngine();
    engine.setGeometryScene(scene(boxMesh([-10, -20, -30], [10, 20, 30])));
    engine.setViewDirection(new QVector3D(0, 0, 1));
    const camera = engine.camera();
    const point = new QVector3D(4, 5, 0);
    const before = project(engine, point);
    camera.pan(new QPoint(30, 20));
    const after = project(engine, point);
    expect(after.x - before.x).toBeCloseTo(30, 3);
    expect(after.y - before.y).toBeCloseTo(20, 3);
    const distance = camera.distance;
    const height = camera.viewHeight();
    camera.zoom(120);
    const zoomed = project(engine, point);
    expect(camera.distance).toBe(distance);
    expect(camera.viewHeight()).toBeCloseTo(height * 0.86);
    expect(zoomed.x - 400).toBeCloseTo((after.x - 400) / 0.86, 3);
    expect(zoomed.y - 300).toBeCloseTo((after.y - 300) / 0.86, 3);
    camera.reset();
    expect(camera.projectionMode).toBe('perspective');
  });

  it.each([
    [1200, 400],
    [400, 1200],
    [600, 600],
  ])('fits all corners in a %s × %s viewport with padding', (width, height) => {
    const camera = new ViewportCamera();
    camera.setViewportSize(width, height);
    camera.fitBounds(new QVector3D(10, 10, 0), new QVector3D(14, 12, 2));
    expect([camera.target.x, camera.target.y, camera.target.z]).toEqual([12, 11, 1]);
    camera.updateViewMatrix();
    camera.updateProjectionMatrix(20);
    for (const x of [10, 14])
      for (const y of [10, 12])
        for (const z of [0, 2]) {
          const p = camera.projectToScreen(new QVector3D(x, y, z));
          expect(p).not.toBeNull();
          expect(p!.x).toBeGreaterThan(width * 0.04);
          expect(p!.x).toBeLessThan(width * 0.96);
          expect(p!.y).toBeGreaterThan(height * 0.04);
          expect(p!.y).toBeLessThan(height * 0.96);
        }
    camera.reset();
    expect(camera.distance).toBe(18);
    expect(camera.target.length()).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { QPoint, QPointF, QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { createEngine, project, updateCamera } from '@tests/renderer/helpers';

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
    const from = new QPointF(400, 300),
      to = new QPointF(400, 200);
    const positions = [];
    for (let i = 0; i < 12; i++) {
      camera.orbit(from, to);
      camera.updateViewMatrix();
      positions.push(camera.cameraPosition());
      expect([...camera.view.data].every(Number.isFinite)).toBe(true);
      expect(camera.cameraPosition().length()).toBeCloseTo(18, 8);
    }
    expect(positions.some((p) => p.y > 10)).toBe(true);
    expect(positions.some((p) => p.z < -10)).toBe(true);
    for (let i = 0; i < 12; i++) camera.orbit(to, from);
    expect(camera.cameraPosition().sub(initial).length()).toBeLessThan(1e-8);
    expect(camera.target.length()).toBe(0);
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

  it('fits bounds with the fixed 45 degree field of view', () => {
    const camera = new ViewportCamera();
    camera.fitBounds(new QVector3D(10, 10, 0), new QVector3D(14, 12, 2));
    expect([camera.target.x, camera.target.y, camera.target.z]).toEqual([12, 11, 1]);
    const radius = 0.5 * Math.hypot(4, 2, 2);
    expect(camera.distance).toBeCloseTo((radius / Math.tan((22.5 * Math.PI) / 180)) * 1.18 + 2, 9);
    camera.reset();
    expect(camera.distance).toBe(18);
    expect(camera.target.length()).toBe(0);
  });
});

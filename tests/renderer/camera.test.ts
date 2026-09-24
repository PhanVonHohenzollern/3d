import { describe, expect, it } from 'vitest';
import { ViewportCamera } from '../../src/core/viewport/ViewportCamera';
import { QPoint, QVector3D } from '../../src/utils/Vector3D';
import { createEngine, project, updateCamera } from './helpers';

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

  it('orbits 0.35 degrees per pixel and clamps the pitch', () => {
    const camera = new ViewportCamera();
    camera.orbit(new QPoint(10, -4));
    expect(camera.yaw).toBeCloseTo(-45 - 3.5);
    expect(camera.pitch).toBeCloseTo(28 - 1.4);
    camera.orbit(new QPoint(0, 1000));
    expect(camera.pitch).toBe(89);
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

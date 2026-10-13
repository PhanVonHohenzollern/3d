import { describe, expect, it, vi } from 'vitest';
import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { projectViewCube } from '@/widgets/viewport/lib/render/viewCube';
import { boxMesh, createEngine, mouse, scene, updateCamera } from '@tests/renderer/helpers';

const directions: QVector3D[] = [];
for (const x of [-1, 0, 1])
  for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) directions.push(new QVector3D(x, y, z));

describe('ViewCube camera directions', () => {
  it('supports all 26 faces, edges and corners, including both poles', () => {
    const engine = createEngine();
    const camera = engine.camera();
    camera.target = new QVector3D(5, 8, -2);
    camera.distance = 35;
    const target = camera.target;
    const available = new Set<string>();
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
      for (const face of faces)
        for (const patch of face.patches) {
          available.add(patch.name);
          expect(patch.points).not.toMatch(/NaN|Infinity/);
        }
    }
    expect(available.size).toBe(26);
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
      const engine = createEngine();
      const initial = engine.cameraOrientation();
      const started = performance.now();
      engine.setViewDirection(new QVector3D(0, 0, -1));
      expect(engine.cameraOrientation()).toBe(initial);
      const callback = frames.get(1)!;
      frames.delete(1);
      callback(started + 90);
      expect(engine.cameraOrientation()).not.toEqual(initial);
      expect(Math.hypot(...Object.values(engine.cameraOrientation()))).toBeCloseTo(1, 8);
      engine.mousePressEvent(mouse(400, 300, 1, 1));
      expect(frames.size).toBe(0);
      engine.detach();
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

import { QMatrix4x4 } from '@/widgets/viewport/lib/math/Matrix4x4';
import { clamp, radians } from '@/widgets/viewport/lib/math/math';
import { Quaternion } from '@/widgets/viewport/lib/math/Quaternion';
import { QPointF, QVector3D, QVector4D, type QPoint } from '@/widgets/viewport/lib/math/Vector3D';

const kVerticalFieldOfView = 45;
const kFitPadding = 1.12;

export type CameraProjection = 'perspective' | 'orthographic';

export interface ScreenRay {
  nearPoint: QVector3D;
  farPoint: QVector3D;
}

export class ViewportCamera {
  target = new QVector3D(0, 0, 0);
  orientation = ViewportCamera.homeOrientation();
  distance = 18;
  projectionMode: CameraProjection = 'perspective';
  orthographicHeight = 2 * this.distance * Math.tan(radians(kVerticalFieldOfView * 0.5));
  readonly projection = new QMatrix4x4();
  readonly view = new QMatrix4x4();
  private m_width = 0;
  private m_height = 0;

  setViewportSize(width: number, height: number): void {
    this.m_width = width;
    this.m_height = height;
  }

  setProjectionMode(mode: CameraProjection): void {
    if (this.projectionMode === mode) return;
    if (mode === 'orthographic') this.orthographicHeight = this.viewHeight();
    else this.distance = this.orthographicHeight / (2 * Math.tan(radians(kVerticalFieldOfView * 0.5)));
    this.projectionMode = mode;
  }

  viewHeight(): number {
    return this.projectionMode === 'orthographic'
      ? this.orthographicHeight
      : 2 * this.distance * Math.tan(radians(kVerticalFieldOfView * 0.5));
  }

  cameraPosition(): QVector3D {
    return this.target.add(this.orientation.rotate(new QVector3D(0, 0, this.distance)));
  }

  static homeOrientation(): Quaternion {
    const pitch = radians(28);

    return Quaternion.lookingFrom(
      new QVector3D(Math.cos(pitch) / Math.SQRT2, -Math.cos(pitch) / Math.SQRT2, Math.sin(pitch)),
    );
  }

  upDirection(): QVector3D {
    return this.orientation.rotate(new QVector3D(0, 1, 0));
  }

  updateViewMatrix(): void {
    const eye = this.cameraPosition();

    this.view.setToIdentity();
    this.view.lookAt(eye, this.target, this.upDirection());
  }

  updateProjectionMatrix(sceneScale: number): void {
    const h = Math.max(1, this.m_height);
    const aspect = Math.max(1, this.m_width) / h;

    const nearPlane = Math.max(0.001, Math.min(10000, this.distance * 0.001));
    const sceneReach = Math.max(10, sceneScale * 6);
    const farPlane = Math.max(1000, this.distance + sceneReach, nearPlane * 1000);

    this.projection.setToIdentity();
    if (this.projectionMode === 'orthographic') {
      const halfHeight = this.orthographicHeight / 2;
      const halfWidth = halfHeight * aspect;
      this.projection.ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, nearPlane, farPlane);
    } else this.projection.perspective(kVerticalFieldOfView, aspect, nearPlane, farPlane);
  }

  viewProjection(): QMatrix4x4 {
    return this.projection.times(this.view);
  }

  projectToScreen(world: QVector3D): QPointF | null {
    const clip = this.viewProjection().map(QVector4D.fromVector3D(world, 1));
    if (clip.w <= 1e-6) return null;

    const ndc = clip.toVector3DAffine();
    if (ndc.z < -1.05 || ndc.z > 1.05) return null;

    const sx = (ndc.x * 0.5 + 0.5) * this.m_width;
    const sy = (1.0 - (ndc.y * 0.5 + 0.5)) * this.m_height;
    if (sx < -100 || sx > this.m_width + 100 || sy < -100 || sy > this.m_height + 100) return null;

    return new QPointF(sx, sy);
  }

  screenRay(screen: QPointF): ScreenRay | null {
    if (this.m_width <= 0 || this.m_height <= 0) return null;

    const x = (2.0 * screen.x) / this.m_width - 1.0;
    const y = 1.0 - (2.0 * screen.y) / this.m_height;

    const { matrix: inverse, invertible } = this.viewProjection().inverted();
    if (!invertible) return null;

    let near4 = inverse.map(new QVector4D(x, y, -1, 1));
    let far4 = inverse.map(new QVector4D(x, y, 1, 1));
    if (Math.abs(near4.w) < 1e-8 || Math.abs(far4.w) < 1e-8) return null;
    near4 = near4.div(near4.w);
    far4 = far4.div(far4.w);

    return { nearPoint: near4.toVector3D(), farPoint: far4.toVector3D() };
  }

  screenToGroundPlane(screen: QPointF): QVector3D | null {
    const ray = this.screenRay(screen);
    if (!ray) return null;
    const direction = ray.farPoint.sub(ray.nearPoint);
    if (Math.abs(direction.z) < 1e-7) return null;

    const t = -ray.nearPoint.z / direction.z;
    if (t < 0) return null;
    const world = ray.nearPoint.add(direction.mul(t));

    return new QVector3D(world.x, world.y, 0);
  }

  orbit(delta: QPoint, pivot: QVector3D = this.target): void {
    const movement = Math.hypot(delta.x, delta.y);
    if (movement === 0) return;
    // Screen-horizontal/vertical motion always uses the camera's up/right axes,
    // even at the poles or upside down. Cursor position never introduces roll.
    const angle = (movement * Math.PI) / Math.max(1, Math.min(this.m_width, this.m_height));
    const rotation = Quaternion.axisAngle(new QVector3D(-delta.y, -delta.x, 0), angle);
    const orientation = this.orientation.multiply(rotation).normalized();
    const worldRotation = orientation.multiply(this.orientation.conjugate());
    // Rotate the eye and its target together around the geometry, preserving Pan.
    this.target = pivot.add(worldRotation.rotate(this.target.sub(pivot)));
    this.orientation = orientation;
  }

  pan(delta: QPoint): void {
    const right = this.orientation.rotate(new QVector3D(1, 0, 0));
    const up = this.upDirection();

    const scale =
      this.projectionMode === 'orthographic'
        ? this.orthographicHeight / Math.max(1, this.m_height)
        : this.distance * 0.0018;
    this.target = this.target.sub(right.mul(delta.x * scale));
    this.target = this.target.add(up.mul(delta.y * scale));
  }

  zoom(angleDeltaY: number): void {
    const steps = angleDeltaY / 120;
    const zoomFactor = Math.pow(0.86, steps);
    if (this.projectionMode === 'orthographic')
      this.orthographicHeight = clamp(this.orthographicHeight * zoomFactor, 0.01, 1.0e8);
    else this.distance = clamp(this.distance * zoomFactor, 0.01, 1.0e8);
  }

  fitBounds(minP: QVector3D, maxP: QVector3D, padding = kFitPadding): void {
    this.target = minP.add(maxP).mul(0.5);
    const tanVertical = Math.tan(radians(kVerticalFieldOfView * 0.5));
    const aspect = Math.max(1, this.m_width) / Math.max(1, this.m_height);
    const tanHorizontal = tanVertical * aspect;
    const toCamera = this.orientation.conjugate();
    const depthMargin = Math.max(0.01, maxP.sub(minP).length() * 0.01);
    let distance = 0.05;
    let halfHeight = 0.005;
    // Solve the perspective-frustum constraints for every bounding-box corner.
    // Its camera-space depth matters as well as its horizontal/vertical extent.
    for (const x of [minP.x, maxP.x])
      for (const y of [minP.y, maxP.y])
        for (const z of [minP.z, maxP.z]) {
          const p = toCamera.rotate(new QVector3D(x, y, z).sub(this.target));
          halfHeight = Math.max(halfHeight, Math.abs(p.x) / aspect, Math.abs(p.y));
          distance = Math.max(
            distance,
            p.z +
              Math.max((padding * Math.abs(p.x)) / tanHorizontal, (padding * Math.abs(p.y)) / tanVertical, depthMargin),
          );
        }
    if (this.projectionMode === 'orthographic') {
      this.orthographicHeight = clamp(2 * halfHeight * padding, 0.01, 1.0e8);
      // Screen scale is independent of depth. Keep the eye outside the bounding
      // sphere so a subsequent Orbit cannot cut through the model.
      distance = Math.max(0.05, maxP.sub(minP).length() / 2 + depthMargin);
    }
    this.distance = clamp(distance, 0.05, 1.0e8);
  }

  reset(): void {
    this.orientation = ViewportCamera.homeOrientation();
    this.target = new QVector3D(0, 0, 0);
    this.distance = 18;
    this.projectionMode = 'perspective';
    this.orthographicHeight = this.viewHeight();
  }
}

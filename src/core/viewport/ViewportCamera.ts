import { QMatrix4x4 } from '../../utils/Matrix4x4';
import { clamp, radians } from '../../utils/math';
import { QPointF, QVector3D, QVector4D, type QPoint } from '../../utils/Vector3D';

export interface ScreenRay {
  nearPoint: QVector3D;
  farPoint: QVector3D;
}

export class ViewportCamera {
  target = new QVector3D(0, 0, 0);
  yaw = -45;
  pitch = 28;
  distance = 18;
  readonly projection = new QMatrix4x4();
  readonly view = new QMatrix4x4();
  private m_width = 0;
  private m_height = 0;

  setViewportSize(width: number, height: number): void {
    this.m_width = width;
    this.m_height = height;
  }

  cameraPosition(): QVector3D {
    const yaw = radians(this.yaw);
    const pitch = radians(this.pitch);

    const cp = Math.cos(pitch);
    const offset = new QVector3D(
      this.distance * cp * Math.cos(yaw),
      this.distance * cp * Math.sin(yaw),
      this.distance * Math.sin(pitch),
    );

    return this.target.add(offset);
  }

  updateViewMatrix(): void {
    const eye = this.cameraPosition();

    this.view.setToIdentity();
    this.view.lookAt(eye, this.target, new QVector3D(0, 0, 1));
  }

  updateProjectionMatrix(sceneScale: number): void {
    const h = Math.max(1, this.m_height);
    const aspect = Math.max(1, this.m_width) / h;

    const nearPlane = Math.max(0.001, Math.min(10000, this.distance * 0.001));
    const sceneReach = Math.max(10, sceneScale * 6);
    const farPlane = Math.max(1000, this.distance + sceneReach, nearPlane * 1000);

    this.projection.setToIdentity();
    this.projection.perspective(45, aspect, nearPlane, farPlane);
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

  orbit(delta: QPoint): void {
    this.yaw -= delta.x * 0.35;
    this.pitch += delta.y * 0.35;
    this.pitch = clamp(this.pitch, -89, 89);
  }

  pan(delta: QPoint): void {
    const eye = this.cameraPosition();
    const forward = this.target.sub(eye).normalized();
    let right = QVector3D.crossProduct(forward, new QVector3D(0, 0, 1));
    if (right.lengthSquared() < 0.000001) {
      right = new QVector3D(1, 0, 0);
    } else {
      right = right.normalize();
    }
    const up = QVector3D.crossProduct(right, forward).normalized();

    const scale = this.distance * 0.0018;
    this.target = this.target.sub(right.mul(delta.x * scale));
    this.target = this.target.add(up.mul(delta.y * scale));
  }

  zoom(angleDeltaY: number): void {
    const steps = angleDeltaY / 120;
    const zoomFactor = Math.pow(0.86, steps);
    this.distance = clamp(this.distance * zoomFactor, 0.01, 1.0e8);
  }

  fitBounds(minP: QVector3D, maxP: QVector3D): void {
    const size = maxP.sub(minP);
    this.target = minP.add(maxP).mul(0.5);
    const radius = Math.max(1, 0.5 * size.length());
    const halfFov = radians(45 * 0.5);
    const fitDistance = radius / Math.max(0.05, Math.tan(halfFov));
    this.distance = clamp(fitDistance * 1.18 + Math.max(2, radius * 0.05), 0.05, 1.0e8);
  }

  reset(): void {
    this.target = new QVector3D(0, 0, 0);
    this.distance = 18;
  }
}

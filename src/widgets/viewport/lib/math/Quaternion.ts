import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';

// Unit quaternions describe camera orientation without a locked world-up axis.
export class Quaternion {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly z = 0,
    readonly w = 1,
  ) {}

  static axisAngle(axis: QVector3D, angle: number): Quaternion {
    const v = axis.normalized().mul(Math.sin(angle / 2));

    return new Quaternion(v.x, v.y, v.z, Math.cos(angle / 2));
  }

  static between(from: QVector3D, to: QVector3D): Quaternion {
    const a = from.normalized();
    const b = to.normalized();
    const dot = QVector3D.dotProduct(a, b);
    if (dot < -1 + 1e-10) {
      const reference = Math.abs(a.x) < 0.9 ? new QVector3D(1, 0, 0) : new QVector3D(0, 1, 0);

      return Quaternion.axisAngle(QVector3D.crossProduct(a, reference), Math.PI);
    }
    const cross = QVector3D.crossProduct(a, b);

    return new Quaternion(cross.x, cross.y, cross.z, 1 + dot).normalized();
  }

  static lookingFrom(direction: QVector3D): Quaternion {
    const back = direction.normalized();
    const upHint = Math.abs(back.z) > 0.999 ? new QVector3D(0, 1, 0) : new QVector3D(0, 0, 1);
    const right = QVector3D.crossProduct(upHint, back).normalized();
    const up = QVector3D.crossProduct(back, right);
    const aim = Quaternion.between(new QVector3D(0, 0, 1), back);

    return Quaternion.between(aim.rotate(new QVector3D(0, 1, 0)), up)
      .multiply(aim)
      .normalized();
  }

  normalized(): Quaternion {
    const length = Math.hypot(this.x, this.y, this.z, this.w);

    return length > 0
      ? new Quaternion(this.x / length, this.y / length, this.z / length, this.w / length)
      : new Quaternion();
  }

  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  multiply(b: Quaternion): Quaternion {
    const { x, y, z, w } = this;

    return new Quaternion(
      w * b.x + x * b.w + y * b.z - z * b.y,
      w * b.y - x * b.z + y * b.w + z * b.x,
      w * b.z + x * b.y - y * b.x + z * b.w,
      w * b.w - x * b.x - y * b.y - z * b.z,
    );
  }

  rotate(vector: QVector3D): QVector3D {
    const axis = new QVector3D(this.x, this.y, this.z);
    const cross = QVector3D.crossProduct(axis, vector).mul(2);

    return vector.add(cross.mul(this.w)).add(QVector3D.crossProduct(axis, cross));
  }

  slerp(target: Quaternion, amount: number): Quaternion {
    let dot = this.x * target.x + this.y * target.y + this.z * target.z + this.w * target.w;
    const sign = dot < 0 ? -1 : 1;
    dot = Math.min(1, Math.abs(dot));
    const angle = Math.acos(dot);
    const sin = Math.sin(angle);
    const a = sin > 1e-6 ? Math.sin((1 - amount) * angle) / sin : 1 - amount;
    const b = (sin > 1e-6 ? Math.sin(amount * angle) / sin : amount) * sign;

    return new Quaternion(
      this.x * a + target.x * b,
      this.y * a + target.y * b,
      this.z * a + target.z * b,
      this.w * a + target.w * b,
    ).normalized();
  }
}

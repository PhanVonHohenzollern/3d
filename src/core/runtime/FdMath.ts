import { CppException } from '../../utils/cpp';

export class FdVector3d {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly z = 0,
  ) {}

  add(v: FdVector3d): FdVector3d {
    return new FdVector3d(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v: FdVector3d): FdVector3d {
    return new FdVector3d(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  neg(): FdVector3d {
    return new FdVector3d(-this.x, -this.y, -this.z);
  }
  mul(s: number): FdVector3d {
    return new FdVector3d(this.x * s, this.y * s, this.z * s);
  }
  div(s: number): FdVector3d {
    if (s === 0) throw new CppException('runtime_error', 'division by zero');
    return new FdVector3d(this.x / s, this.y / s, this.z / s);
  }

  dotProduct(v: FdVector3d): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  crossProduct(v: FdVector3d): FdVector3d {
    return new FdVector3d(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }
  lengthSqrd(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length(): number {
    return Math.sqrt(this.lengthSqrd());
  }
  normal(): FdVector3d {
    const len = this.length();
    if (len === 0) return new FdVector3d();
    return this.div(len);
  }
  normalize(): FdVector3d {
    const len = this.length();
    if (len === 0) return this;
    return new FdVector3d(this.x / len, this.y / len, this.z / len);
  }
  rotateBy(angle: number, axis: FdVector3d): FdVector3d {
    const k = axis.normal();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const cross = k.crossProduct(this);
    const dot = k.dotProduct(this);
    return this.mul(c)
      .add(cross.mul(s))
      .add(k.mul(dot * (1.0 - c)));
  }
  mirror(normalToPlane: FdVector3d): FdVector3d {
    const n = normalToPlane.normal();
    return this.sub(n.mul(2.0 * this.dotProduct(n)));
  }
  angleTo(other: FdVector3d): number {
    const denom = this.length() * other.length();
    if (denom === 0) return 0;
    const c = Math.min(Math.max(this.dotProduct(other) / denom, -1.0), 1.0);
    return Math.acos(c);
  }
}

export class FdPoint3d {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly z = 0,
  ) {}

  add(v: FdVector3d): FdPoint3d {
    return new FdPoint3d(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(p: FdPoint3d): FdVector3d;
  sub(v: FdVector3d): FdPoint3d;
  sub(o: FdPoint3d | FdVector3d): FdVector3d | FdPoint3d {
    if (o instanceof FdPoint3d) return new FdVector3d(this.x - o.x, this.y - o.y, this.z - o.z);
    return new FdPoint3d(this.x - o.x, this.y - o.y, this.z - o.z);
  }
  rotateBy(angle: number, axis: FdVector3d, wrtPoint: FdPoint3d = new FdPoint3d()): FdPoint3d {
    const rel = new FdVector3d(this.x - wrtPoint.x, this.y - wrtPoint.y, this.z - wrtPoint.z).rotateBy(angle, axis);
    return new FdPoint3d(wrtPoint.x + rel.x, wrtPoint.y + rel.y, wrtPoint.z + rel.z);
  }
}

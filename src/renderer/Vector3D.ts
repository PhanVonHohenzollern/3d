// Minimal ports of the Qt value types used by renderer/Viewport3D:
// QVector3D, QVector4D, QPoint and QPointF.
//
// The C++ types store floats; these keep JavaScript doubles. The difference is
// far below anything the viewport can show (projection, picking radii), and
// every buffer sent to WebGL is a Float32Array, exactly like the C++ upload.

/** qFuzzyIsNull(float) */
export function qFuzzyIsNull(f: number): boolean {
  return Math.abs(f) <= 0.00001;
}

/** qRound(double) for the coordinate ranges used here. */
export function qRound(d: number): number {
  return Math.round(d);
}

export class QVector3D {
  constructor(readonly x = 0, readonly y = 0, readonly z = 0) {}

  static crossProduct(a: QVector3D, b: QVector3D): QVector3D {
    return new QVector3D(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }

  static dotProduct(a: QVector3D, b: QVector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  add(v: QVector3D): QVector3D { return new QVector3D(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: QVector3D): QVector3D { return new QVector3D(this.x - v.x, this.y - v.y, this.z - v.z); }
  neg(): QVector3D { return new QVector3D(-this.x, -this.y, -this.z); }
  mul(s: number): QVector3D { return new QVector3D(this.x * s, this.y * s, this.z * s); }
  div(s: number): QVector3D { return new QVector3D(this.x / s, this.y / s, this.z / s); }

  lengthSquared(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  /** Qt 6: qHypot(x, y, z) */
  length(): number { return Math.hypot(this.x, this.y, this.z); }

  /**
   * QVector3D::normalized(): near-unit vectors are returned unchanged and
   * near-null vectors become (0, 0, 0). QVector3D::normalize() behaves the
   * same way in place (a near-null vector stays unchanged, i.e. near-null).
   */
  normalized(): QVector3D {
    const len = this.length();
    return qFuzzyIsNull(len - 1.0) ? this
      : qFuzzyIsNull(len) ? new QVector3D()
      : new QVector3D(this.x / len, this.y / len, this.z / len);
  }

  /** In-place QVector3D::normalize(), as a value. */
  normalize(): QVector3D {
    const len = this.length();
    if (qFuzzyIsNull(len - 1.0) || qFuzzyIsNull(len)) return this;
    return new QVector3D(this.x / len, this.y / len, this.z / len);
  }
}

export class QVector4D {
  constructor(readonly x = 0, readonly y = 0, readonly z = 0, readonly w = 0) {}

  static fromVector3D(v: QVector3D, w: number): QVector4D {
    return new QVector4D(v.x, v.y, v.z, w);
  }

  /** operator[] */
  at(i: number): number {
    return i === 0 ? this.x : i === 1 ? this.y : i === 2 ? this.z : this.w;
  }

  add(v: QVector4D): QVector4D { return new QVector4D(this.x + v.x, this.y + v.y, this.z + v.z, this.w + v.w); }
  sub(v: QVector4D): QVector4D { return new QVector4D(this.x - v.x, this.y - v.y, this.z - v.z, this.w - v.w); }
  mul(s: number): QVector4D { return new QVector4D(this.x * s, this.y * s, this.z * s, this.w * s); }
  div(s: number): QVector4D { return new QVector4D(this.x / s, this.y / s, this.z / s, this.w / s); }

  toVector3D(): QVector3D { return new QVector3D(this.x, this.y, this.z); }

  /** QVector4D::toVector3DAffine() */
  toVector3DAffine(): QVector3D {
    if (qFuzzyIsNull(this.w)) return new QVector3D();
    return new QVector3D(this.x / this.w, this.y / this.w, this.z / this.w);
  }
}

/** QPoint (integer logical pixels). */
export class QPoint {
  constructor(readonly x = 0, readonly y = 0) {}
  sub(p: QPoint): QPoint { return new QPoint(this.x - p.x, this.y - p.y); }
  manhattanLength(): number { return Math.abs(this.x) + Math.abs(this.y); }
}

/** QPointF (logical pixels). */
export class QPointF {
  constructor(readonly x = 0, readonly y = 0) {}

  static dotProduct(a: QPointF, b: QPointF): number { return a.x * b.x + a.y * b.y; }

  add(p: QPointF): QPointF { return new QPointF(this.x + p.x, this.y + p.y); }
  sub(p: QPointF): QPointF { return new QPointF(this.x - p.x, this.y - p.y); }
  mul(s: number): QPointF { return new QPointF(this.x * s, this.y * s); }
  div(s: number): QPointF { return new QPointF(this.x / s, this.y / s); }
  /** QPointF::toPoint() */
  toPoint(): QPoint { return new QPoint(qRound(this.x), qRound(this.y)); }
}

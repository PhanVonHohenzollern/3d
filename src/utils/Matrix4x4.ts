import { qFuzzyIsNull } from './math';
import { QVector3D, QVector4D } from './Vector3D';

export class QMatrix4x4 {
  readonly data = new Float32Array(16);

  constructor(columnMajor?: ArrayLike<number>) {
    if (columnMajor) this.data.set(columnMajor);
    else this.setToIdentity();
  }

  private m(col: number, row: number): number {
    return this.data[col * 4 + row];
  }

  get(row: number, column: number): number {
    return this.data[column * 4 + row];
  }

  setToIdentity(): void {
    this.data.fill(0);
    this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
  }

  clone(): QMatrix4x4 {
    return new QMatrix4x4(this.data);
  }

  static multiply(m1: QMatrix4x4, m2: QMatrix4x4): QMatrix4x4 {
    const result = new QMatrix4x4();
    for (let col = 0; col < 4; ++col) {
      for (let row = 0; row < 4; ++row) {
        result.data[col * 4 + row] =
          m1.m(0, row) * m2.m(col, 0) +
          m1.m(1, row) * m2.m(col, 1) +
          m1.m(2, row) * m2.m(col, 2) +
          m1.m(3, row) * m2.m(col, 3);
      }
    }

    return result;
  }

  times(other: QMatrix4x4): QMatrix4x4 {
    return QMatrix4x4.multiply(this, other);
  }

  multiplyInPlace(other: QMatrix4x4): void {
    this.data.set(QMatrix4x4.multiply(this, other).data);
  }

  map(v: QVector4D): QVector4D {
    const m = this.data;

    return new QVector4D(
      v.x * m[0] + v.y * m[4] + v.z * m[8] + v.w * m[12],
      v.x * m[1] + v.y * m[5] + v.z * m[9] + v.w * m[13],
      v.x * m[2] + v.y * m[6] + v.z * m[10] + v.w * m[14],
      v.x * m[3] + v.y * m[7] + v.z * m[11] + v.w * m[15],
    );
  }

  perspective(verticalAngle: number, aspectRatio: number, nearPlane: number, farPlane: number): void {
    if (nearPlane === farPlane || aspectRatio === 0) return;

    const radians = ((verticalAngle / 2) * Math.PI) / 180;
    const sine = Math.sin(radians);
    if (sine === 0) return;
    const cotan = Math.cos(radians) / sine;
    const clip = farPlane - nearPlane;
    const p = new QMatrix4x4(new Float32Array(16));

    const set = (col: number, row: number, value: number) => {
      p.data[col * 4 + row] = value;
    };

    set(0, 0, cotan / aspectRatio);
    set(1, 1, cotan);
    set(2, 2, -(nearPlane + farPlane) / clip);
    set(3, 2, -(2 * nearPlane * farPlane) / clip);
    set(2, 3, -1);
    set(3, 3, 0);

    this.multiplyInPlace(p);
  }

  lookAt(eye: QVector3D, center: QVector3D, up: QVector3D): void {
    let forward = center.sub(eye);
    if (qFuzzyIsNull(forward.x) && qFuzzyIsNull(forward.y) && qFuzzyIsNull(forward.z)) return;

    forward = forward.normalize();
    const side = QVector3D.crossProduct(forward, up).normalized();
    const upVector = QVector3D.crossProduct(side, forward);

    const r = new QMatrix4x4();

    const set = (col: number, row: number, value: number) => {
      r.data[col * 4 + row] = value;
    };

    set(0, 0, side.x);
    set(1, 0, side.y);
    set(2, 0, side.z);
    set(3, 0, 0);
    set(0, 1, upVector.x);
    set(1, 1, upVector.y);
    set(2, 1, upVector.z);
    set(3, 1, 0);
    set(0, 2, -forward.x);
    set(1, 2, -forward.y);
    set(2, 2, -forward.z);
    set(3, 2, 0);
    set(0, 3, 0);
    set(1, 3, 0);
    set(2, 3, 0);
    set(3, 3, 1);

    this.multiplyInPlace(r);
    this.translate(eye.neg());
  }

  translate(v: QVector3D): void {
    const d = this.data;
    d[12] += d[0] * v.x + d[4] * v.y + d[8] * v.z;
    d[13] += d[1] * v.x + d[5] * v.y + d[9] * v.z;
    d[14] += d[2] * v.x + d[6] * v.y + d[10] * v.z;
    d[15] += d[3] * v.x + d[7] * v.y + d[11] * v.z;
  }

  inverted(): { matrix: QMatrix4x4; invertible: boolean } {
    const mm = (col: number, row: number) => this.m(col, row);

    const det2 = (c0: number, c1: number, r0: number, r1: number) => mm(c0, r0) * mm(c1, r1) - mm(c0, r1) * mm(c1, r0);

    const det3 = (c0: number, c1: number, c2: number, r0: number, r1: number, r2: number) =>
      mm(c0, r0) * det2(c1, c2, r1, r2) - mm(c1, r0) * det2(c0, c2, r1, r2) + mm(c2, r0) * det2(c0, c1, r1, r2);

    let det = mm(0, 0) * det3(1, 2, 3, 1, 2, 3);
    det -= mm(1, 0) * det3(0, 2, 3, 1, 2, 3);
    det += mm(2, 0) * det3(0, 1, 3, 1, 2, 3);
    det -= mm(3, 0) * det3(0, 1, 2, 1, 2, 3);
    if (det === 0) return { matrix: new QMatrix4x4(), invertible: false };
    det = 1 / det;

    const inv = new QMatrix4x4();

    const set = (col: number, row: number, value: number) => {
      inv.data[col * 4 + row] = value;
    };

    set(0, 0, det3(1, 2, 3, 1, 2, 3) * det);
    set(0, 1, -det3(0, 2, 3, 1, 2, 3) * det);
    set(0, 2, det3(0, 1, 3, 1, 2, 3) * det);
    set(0, 3, -det3(0, 1, 2, 1, 2, 3) * det);
    set(1, 0, -det3(1, 2, 3, 0, 2, 3) * det);
    set(1, 1, det3(0, 2, 3, 0, 2, 3) * det);
    set(1, 2, -det3(0, 1, 3, 0, 2, 3) * det);
    set(1, 3, det3(0, 1, 2, 0, 2, 3) * det);
    set(2, 0, det3(1, 2, 3, 0, 1, 3) * det);
    set(2, 1, -det3(0, 2, 3, 0, 1, 3) * det);
    set(2, 2, det3(0, 1, 3, 0, 1, 3) * det);
    set(2, 3, -det3(0, 1, 2, 0, 1, 3) * det);
    set(3, 0, -det3(1, 2, 3, 0, 1, 2) * det);
    set(3, 1, det3(0, 2, 3, 0, 1, 2) * det);
    set(3, 2, -det3(0, 1, 3, 0, 1, 2) * det);
    set(3, 3, det3(0, 1, 2, 0, 1, 2) * det);

    return { matrix: inv, invertible: true };
  }

  normalMatrix(): Float32Array {
    const inv = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    const mm = (col: number, row: number) => this.m(col, row);

    let det =
      mm(0, 0) * (mm(1, 1) * mm(2, 2) - mm(1, 2) * mm(2, 1)) -
      mm(1, 0) * (mm(0, 1) * mm(2, 2) - mm(0, 2) * mm(2, 1)) +
      mm(2, 0) * (mm(0, 1) * mm(1, 2) - mm(0, 2) * mm(1, 1));
    if (det === 0) return inv;
    det = 1 / det;

    inv[0 + 0 * 3] = (mm(1, 1) * mm(2, 2) - mm(2, 1) * mm(1, 2)) * det;
    inv[1 + 0 * 3] = -(mm(1, 0) * mm(2, 2) - mm(1, 2) * mm(2, 0)) * det;
    inv[2 + 0 * 3] = (mm(1, 0) * mm(2, 1) - mm(1, 1) * mm(2, 0)) * det;
    inv[0 + 1 * 3] = -(mm(0, 1) * mm(2, 2) - mm(2, 1) * mm(0, 2)) * det;
    inv[1 + 1 * 3] = (mm(0, 0) * mm(2, 2) - mm(0, 2) * mm(2, 0)) * det;
    inv[2 + 1 * 3] = -(mm(0, 0) * mm(2, 1) - mm(0, 1) * mm(2, 0)) * det;
    inv[0 + 2 * 3] = (mm(0, 1) * mm(1, 2) - mm(0, 2) * mm(1, 1)) * det;
    inv[1 + 2 * 3] = -(mm(0, 0) * mm(1, 2) - mm(0, 2) * mm(1, 0)) * det;
    inv[2 + 2 * 3] = (mm(0, 0) * mm(1, 1) - mm(1, 0) * mm(0, 1)) * det;

    return inv;
  }
}

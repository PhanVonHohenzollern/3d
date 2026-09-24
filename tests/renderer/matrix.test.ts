// QMatrix4x4 port: checked against the formulas documented for
// QMatrix4x4::perspective() / lookAt() (the gluPerspective / gluLookAt
// matrices, column-major m[col][row]) and against algebraic identities.
import { describe, expect, it } from 'vitest';
import { QMatrix4x4 } from '../../src/renderer/Matrix4x4';
import { QVector3D, QVector4D } from '../../src/renderer/Vector3D';

function expectMatrixClose(actual: QMatrix4x4, expected: number[][], digits = 5) {
  for (let row = 0; row < 4; ++row)
    for (let col = 0; col < 4; ++col)
      expect(actual.get(row, col), `(${row}, ${col})`).toBeCloseTo(expected[row][col], digits);
}

const identityRows = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

describe('QMatrix4x4', () => {
  it('stores elements column-major like QMatrix4x4::constData()', () => {
    const m = new QMatrix4x4();
    m.translate(new QVector3D(1, 2, 3));
    // Translation lives in column 3 == data[12..14].
    expect(Array.from(m.data.slice(12, 15))).toEqual([1, 2, 3]);
    expect(m.get(0, 3)).toBe(1);
  });

  it('perspective() matches the documented projection matrix', () => {
    const fov = 45,
      aspect = 1.6,
      near = 0.018,
      far = 1000;
    const m = new QMatrix4x4();
    m.perspective(fov, aspect, near, far);
    const f = 1 / Math.tan(((fov / 2) * Math.PI) / 180);
    expectMatrixClose(m, [
      [f / aspect, 0, 0, 0],
      [0, f, 0, 0],
      [0, 0, -(near + far) / (far - near), -(2 * near * far) / (far - near)],
      [0, 0, -1, 0],
    ]);
  });

  it('perspective() ignores degenerate volumes like Qt', () => {
    const m = new QMatrix4x4();
    m.perspective(45, 0, 1, 10);
    expectMatrixClose(m, identityRows);
    m.perspective(45, 1, 5, 5);
    expectMatrixClose(m, identityRows);
  });

  it('lookAt() builds the gluLookAt view matrix', () => {
    const eye = new QVector3D(4, -3, 2);
    const center = new QVector3D(0.5, 1, -1);
    const up = new QVector3D(0, 0, 1);
    const m = new QMatrix4x4();
    m.lookAt(eye, center, up);

    const f = center.sub(eye).normalized();
    const s = QVector3D.crossProduct(f, up).normalized();
    const u = QVector3D.crossProduct(s, f);
    const t = (v: QVector3D) => -QVector3D.dotProduct(v, eye);
    expectMatrixClose(m, [
      [s.x, s.y, s.z, t(s)],
      [u.x, u.y, u.z, t(u)],
      [-f.x, -f.y, -f.z, -t(f)],
      [0, 0, 0, 1],
    ]);

    // The eye maps to the origin and the center onto the -Z axis.
    const e = m.map(QVector4D.fromVector3D(eye, 1));
    expect([e.x, e.y, e.z]).toEqual([expect.closeTo(0, 5), expect.closeTo(0, 5), expect.closeTo(0, 5)]);
    const c = m.map(QVector4D.fromVector3D(center, 1));
    expect(c.x).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
    expect(c.z).toBeCloseTo(-center.sub(eye).length(), 4);
  });

  it('lookAt() is a no-op when eye == center', () => {
    const m = new QMatrix4x4();
    m.lookAt(new QVector3D(1, 1, 1), new QVector3D(1, 1, 1), new QVector3D(0, 0, 1));
    expectMatrixClose(m, identityRows);
  });

  it('multiplies as m1 * m2 and maps column vectors', () => {
    const a = new QMatrix4x4();
    a.translate(new QVector3D(10, 0, 0));
    const b = new QMatrix4x4();
    b.perspective(60, 1, 1, 100);
    const ab = a.times(b);
    const v = new QVector4D(1, 2, -5, 1);
    const direct = a.map(b.map(v));
    const combined = ab.map(v);
    expect(combined.x).toBeCloseTo(direct.x, 4);
    expect(combined.y).toBeCloseTo(direct.y, 4);
    expect(combined.z).toBeCloseTo(direct.z, 4);
    expect(combined.w).toBeCloseTo(direct.w, 4);
  });

  it('inverted() inverts a projection * view matrix', () => {
    const projection = new QMatrix4x4();
    projection.perspective(45, 800 / 600, 0.018, 1000);
    const view = new QMatrix4x4();
    view.lookAt(new QVector3D(12, -12, 8.4), new QVector3D(0, 0, 0), new QVector3D(0, 0, 1));
    const pv = projection.times(view);
    const { matrix, invertible } = pv.inverted();
    expect(invertible).toBe(true);
    expectMatrixClose(pv.times(matrix), identityRows, 4);
  });

  it('inverted() reports singular matrices', () => {
    const m = new QMatrix4x4(new Float32Array(16));
    const { matrix, invertible } = m.inverted();
    expect(invertible).toBe(false);
    expectMatrixClose(matrix, identityRows);
  });

  it('normalMatrix() is the inverse transpose of the upper 3x3', () => {
    const m = new QMatrix4x4([2, 0.5, 0, 0, 0, 3, 1, 0, 0.25, 0, 4, 0, 7, 8, 9, 1]);
    const n = m.normalMatrix();
    // (M3^-1)^T * M3^T == I  <=>  n (column-major 3x3) times M3^T is the identity.
    for (let row = 0; row < 3; ++row) {
      for (let col = 0; col < 3; ++col) {
        let sum = 0;
        for (let k = 0; k < 3; ++k) sum += n[k * 3 + row] * m.get(col, k);
        expect(sum).toBeCloseTo(row === col ? 1 : 0, 5);
      }
    }
  });

  it('normalMatrix() of a view matrix is its rotation part', () => {
    const view = new QMatrix4x4();
    view.lookAt(new QVector3D(3, 4, 5), new QVector3D(0, 0, 0), new QVector3D(0, 0, 1));
    const n = view.normalMatrix();
    for (let row = 0; row < 3; ++row)
      for (let col = 0; col < 3; ++col) expect(n[col * 3 + row]).toBeCloseTo(view.get(row, col), 5);
  });
});

describe('QVector3D', () => {
  it('normalized() keeps near-unit vectors and zeroes near-null ones', () => {
    const nearUnit = new QVector3D(1.000001, 0, 0);
    expect(nearUnit.normalized()).toBe(nearUnit);
    expect(new QVector3D(1e-6, 0, 0).normalized()).toEqual(new QVector3D(0, 0, 0));
    const v = new QVector3D(3, 0, 4).normalized();
    expect(v.x).toBeCloseTo(0.6);
    expect(v.z).toBeCloseTo(0.8);
  });

  it('normalize() leaves near-null vectors unchanged', () => {
    const tiny = new QVector3D(2e-6, 0, 0);
    expect(tiny.normalize()).toBe(tiny);
  });
});

import { DVec3, type Xyz } from './DVec3';

export type DMat4 = number[][];

function zeroMatrix(): DMat4 {
  return [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
}

export function identityMatrix(): DMat4 {
  const r = zeroMatrix();
  for (let i = 0; i < 4; ++i) r[i][i] = 1.0;

  return r;
}

export function multiply(a: DMat4, b: DMat4): DMat4 {
  const r = zeroMatrix();
  for (let row = 0; row < 4; ++row)
    for (let col = 0; col < 4; ++col) for (let k = 0; k < 4; ++k) r[row][col] += a[row][k] * b[k][col];

  return r;
}

export function translationMatrix(v: Xyz): DMat4 {
  const r = identityMatrix();
  r[0][3] = v.x;
  r[1][3] = v.y;
  r[2][3] = v.z;

  return r;
}

export function rotationMatrix(angle: number, axisInput: Xyz): DMat4 {
  const len = Math.sqrt(axisInput.x * axisInput.x + axisInput.y * axisInput.y + axisInput.z * axisInput.z);
  if (len <= 1e-12) return identityMatrix();
  const x = axisInput.x / len,
    y = axisInput.y / len,
    z = axisInput.z / len;
  const c = Math.cos(angle),
    si = Math.sin(angle),
    t = 1.0 - c;
  const r = identityMatrix();
  r[0][0] = t * x * x + c;
  r[0][1] = t * x * y - si * z;
  r[0][2] = t * x * z + si * y;
  r[1][0] = t * x * y + si * z;
  r[1][1] = t * y * y + c;
  r[1][2] = t * y * z - si * x;
  r[2][0] = t * x * z - si * y;
  r[2][1] = t * y * z + si * x;
  r[2][2] = t * z * z + c;

  return r;
}

export function transformPoint(m: DMat4, p: DVec3): DVec3 {
  return new DVec3(
    m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z + m[0][3],
    m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z + m[1][3],
    m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z + m[2][3],
  );
}

export function transformDirection(m: DMat4, v: DVec3): DVec3 {
  return new DVec3(
    m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
  );
}

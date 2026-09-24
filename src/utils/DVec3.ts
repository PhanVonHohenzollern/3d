export interface Xyz {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class DVec3 {
  constructor(
    readonly x = 0.0,
    readonly y = 0.0,
    readonly z = 0.0,
  ) {}

  add(b: DVec3): DVec3 {
    return new DVec3(this.x + b.x, this.y + b.y, this.z + b.z);
  }
  sub(b: DVec3): DVec3 {
    return new DVec3(this.x - b.x, this.y - b.y, this.z - b.z);
  }
  mul(s: number): DVec3 {
    return new DVec3(this.x * s, this.y * s, this.z * s);
  }
  div(s: number): DVec3 {
    return new DVec3(this.x / s, this.y / s, this.z / s);
  }
}

export function dot(a: DVec3, b: DVec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: DVec3, b: DVec3): DVec3 {
  return new DVec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

export function length(v: DVec3): number {
  return Math.sqrt(dot(v, v));
}

export function normalized(v: DVec3): DVec3 {
  const len = length(v);
  if (len <= 1e-12) return new DVec3();
  return v.div(len);
}

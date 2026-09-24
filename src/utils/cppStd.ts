export const stdMin = (a: number, b: number): number => (b < a ? b : a);
export const stdMax = (a: number, b: number): number => (a < b ? b : a);
export const stdClamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : hi < v ? hi : v);
// Out-of-range d converts like the x86-64 desktop builds (INT64_MIN, so 0), not saturating like arm64.
export function llroundToInt(d: number): number {
  if (!(Math.abs(d) < 9223372036854775808)) return 0;
  let r = Math.trunc(d);
  if (Math.abs(d - r) >= 0.5) r += d < 0 ? -1 : 1;
  return r | 0;
}
export function stdSort4<T>(v: T[], c: (a: T, b: T) => boolean): void {
  const swap = (i: number, j: number) => {
    const t = v[i];
    v[i] = v[j];
    v[j] = t;
  };
  if (!c(v[1], v[0])) {
    if (c(v[2], v[1])) {
      swap(1, 2);
      if (c(v[1], v[0])) swap(0, 1);
    }
  } else if (c(v[2], v[1])) {
    swap(0, 2);
  } else {
    swap(0, 1);
    if (c(v[2], v[1])) swap(1, 2);
  }
  if (c(v[3], v[2])) {
    swap(2, 3);
    if (c(v[2], v[1])) {
      swap(1, 2);
      if (c(v[1], v[0])) swap(0, 1);
    }
  }
}
export function stdSort4Doubles(v: number[]): void {
  const condSwap = (x: number, y: number) => {
    const r = v[x] < v[y];
    const tmp = r ? v[x] : v[y];
    v[y] = r ? v[y] : v[x];
    v[x] = tmp;
  };
  condSwap(0, 2);
  condSwap(1, 3);
  condSwap(0, 1);
  condSwap(2, 3);
  condSwap(1, 2);
}
export function eraseUnique(values: number[]): void {
  let result = 0;
  for (let i = 1; i < values.length; ++i) {
    if (!(values[result] === values[i])) values[++result] = values[i];
  }
  if (values.length) values.length = result + 1;
}

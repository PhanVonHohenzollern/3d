export function qFuzzyIsNull(f: number): boolean {
  return Math.abs(f) <= 0.00001;
}

export function qRound(d: number): number {
  return Math.round(d);
}

export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : hi < value ? hi : value;
}

export function isValidIndex(index: number, count: number): boolean {
  return index >= 0 && index < count;
}

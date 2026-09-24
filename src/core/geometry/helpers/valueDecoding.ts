import { llroundToInt } from '../../../utils/cppStd';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import { RuntimeArray, type RuntimeValue } from '../../runtime/RuntimeValue';

export interface Ref<T> {
  v: T;
}

export const ref = <T>(v: T): Ref<T> => ({ v });

export function asPoint(value: RuntimeValue, out: Ref<FdPoint3d>): boolean {
  if (value instanceof FdPoint3d) {
    out.v = value;
    return true;
  }
  return false;
}

export function asVector(value: RuntimeValue, out: Ref<FdVector3d>): boolean {
  if (value instanceof FdVector3d) {
    out.v = value;
    return true;
  }
  return false;
}

export function asNumber(value: RuntimeValue, out: Ref<number>): boolean {
  if (typeof value === 'number') {
    out.v = value;
    return true;
  }
  if (typeof value === 'bigint') {
    out.v = Number(value);
    return true;
  }
  if (typeof value === 'boolean') {
    out.v = value ? 1.0 : 0.0;
    return true;
  }
  return false;
}

export function asInt(value: RuntimeValue, out: Ref<number>): boolean {
  const d = ref(0.0);
  if (!asNumber(value, d)) return false;
  out.v = llroundToInt(d.v);
  return true;
}

export function asBool(value: RuntimeValue, out: Ref<boolean>): boolean {
  if (typeof value === 'boolean') {
    out.v = value;
    return true;
  }
  const n = ref(0.0);
  if (asNumber(value, n)) {
    out.v = n.v !== 0.0;
    return true;
  }
  return false;
}

function asArray(value: RuntimeValue): RuntimeArray | null {
  return value instanceof RuntimeArray ? value : null;
}

export function pointArray(value: RuntimeValue, out: FdPoint3d[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const p = ref(new FdPoint3d());
    if (!asPoint(element, p)) return false;
    out.push(p.v);
  }
  return true;
}

export function vectorArray(value: RuntimeValue, out: FdVector3d[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const v = ref(new FdVector3d());
    if (!asVector(element, v)) return false;
    out.push(v.v);
  }
  return true;
}

export function numberArray(value: RuntimeValue, out: number[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const n = ref(0.0);
    if (!asNumber(element, n)) return false;
    out.push(n.v);
  }
  return true;
}

export function boolArray(value: RuntimeValue, out: boolean[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const b = ref(false);
    if (!asBool(element, b)) return false;
    out.push(b.v);
  }
  return true;
}

export function numberMatrix(value: RuntimeValue, out: number[][]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const rowValue of a.elements) {
    const row: number[] = [];
    if (!numberArray(rowValue, row)) return false;
    out.push(row);
  }
  return true;
}

export function intArray(value: RuntimeValue, out: number[]): boolean {
  const a = asArray(value);
  if (!a) return false;
  out.length = 0;
  for (const element of a.elements) {
    const n = ref(0);
    if (!asInt(element, n)) return false;
    out.push(n.v);
  }
  return true;
}

export function twoPointsFromArray(value: RuntimeValue, a: Ref<FdPoint3d>, b: Ref<FdPoint3d>): boolean {
  const points: FdPoint3d[] = [];
  if (!pointArray(value, points) || points.length < 2) return false;
  a.v = points[0];
  b.v = points[1];
  return true;
}

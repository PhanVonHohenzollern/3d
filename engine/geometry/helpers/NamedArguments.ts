import { cross, DVec3, length, normalized } from '@engine/math';
import { FdPoint3d, FdVector3d, isArray, runtimeNumber, runtimeTruthy, type RuntimeValue } from '@engine/runtime';
import { basisFromUp, toVec } from '@engine/geometry/helpers/geometryMath';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import {
  asBool,
  asInt,
  asNumber,
  boolArray,
  intArray,
  numberArray,
  numberMatrix,
  pointArray,
  ref,
  vectorArray,
} from '@engine/geometry/helpers/valueDecoding';

function isScalar(value: RuntimeValue): value is number | bigint | boolean {
  return typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean';
}

// A placement read from the arguments: centre, normal, and the up and right directions across it.
export type Frame = { center: DVec3; normal: DVec3; up: DVec3; right: DVec3 };

/** Read by the selected overload's formal names, including SDK default arguments. */
export class NamedArguments {
  private values = new Map<string, RuntimeValue>();

  constructor(context: MeshBuildContext, args: RuntimeValue[]) {
    const signature = context.call.signature;
    if (!signature) throw new Error('no matching SDK overload');
    signature.parameters.forEach((p, i) => this.values.set(p.name, args[i]));
  }

  // Whether the call's overload has a parameter with this name.
  has(name: string): boolean {
    return this.values.has(name);
  }

  // Strict readers: the value must already have the SDK type, as the C++ call would require.
  // Each one throws an error naming the parameter otherwise.

  point(name: string): FdPoint3d {
    const value = this.get(name);
    if (!(value instanceof FdPoint3d)) throw new Error(`${name} must be an FdPoint3d`);

    return value;
  }

  fdVector(name: string): FdVector3d {
    const value = this.get(name);
    if (!(value instanceof FdVector3d)) throw new Error(`${name} must be an FdVector3d`);

    return value;
  }

  real(name: string): number {
    const out = ref(0);
    if (!asNumber(this.get(name), out)) throw new Error(`${name} must be a number`);

    return out.v;
  }

  // Rounded to the nearest integer, as the SDK's int parameters are.
  int(name: string): number {
    const out = ref(0);
    if (!asInt(this.get(name), out)) throw new Error(`${name} must be an integer`);

    return out.v;
  }

  flag(name: string): boolean {
    const out = ref(false);
    if (!asBool(this.get(name), out)) throw new Error(`${name} must be a bool`);

    return out.v;
  }

  // Lenient readers for optional settings: a missing or non-scalar value gives the fallback.

  optionalFlag(name: string, fallback: boolean): boolean {
    return isScalar(this.get(name)) ? this.flag(name) : fallback;
  }

  optionalInt(name: string, fallback: number): number {
    return isScalar(this.get(name)) ? this.int(name) : fallback;
  }

  optionalReal(name: string, fallback: number): number {
    return isScalar(this.get(name)) ? this.real(name) : fallback;
  }

  pointArray(name: string): FdPoint3d[] {
    return this.#array(name, pointArray, 'an FdPoint3d array');
  }

  vectorArray(name: string): FdVector3d[] {
    return this.#array(name, vectorArray, 'an FdVector3d array');
  }

  realArray(name: string): number[] {
    return this.#array(name, numberArray, 'a number array');
  }

  intArray(name: string): number[] {
    return this.#array(name, intArray, 'an integer array');
  }

  flagArray(name: string): boolean[] {
    return this.#array(name, boolArray, 'a bool array');
  }

  realMatrix(name: string): number[][] {
    return this.#array(name, numberMatrix, 'a number matrix');
  }

  #array<T>(name: string, decode: (value: RuntimeValue, out: T[]) => boolean, kind: string): T[] {
    const out: T[] = [];
    if (!decode(this.get(name), out)) throw new Error(`${name} must be ${kind}`);

    return out;
  }

  get(...names: string[]): RuntimeValue {
    for (const name of names) if (this.values.has(name)) return this.values.get(name);

    return undefined;
  }

  num(name: string, fallback?: number): number {
    const value = this.get(name);
    const result = value === undefined && fallback !== undefined ? fallback : runtimeNumber(value);
    if (!Number.isFinite(result)) throw new Error(`${name} must be finite`);

    return result;
  }

  positive(name: string, fallback?: number): number {
    const n = this.num(name, fallback);
    if (n <= 0) throw new Error(`${name} must be positive`);

    return n;
  }

  count(name: string, fallback = 10, max = 256): number {
    return Math.max(1, Math.min(max, Math.trunc(this.positive(name, fallback))));
  }

  bool(name: string, fallback = false): boolean {
    const value = this.get(name);

    return value === undefined ? fallback : runtimeTruthy(value);
  }

  numbers(name: string): number[] {
    const a = this.get(name);
    if (!isArray(a)) throw new Error(`${name} requires an array`);
    const out = a.elements.map(runtimeNumber);
    if (!out.every(Number.isFinite)) throw new Error(`${name} contains non-finite values`);

    return out;
  }

  points(name: string): DVec3[] {
    const a = this.get(name);
    if (!isArray(a)) throw new Error(`${name} requires a point array`);

    return a.elements.map((value) => this.vectorValue(value, name));
  }

  vectorValue(value: RuntimeValue, name: string): DVec3 {
    if (value instanceof FdPoint3d || value instanceof FdVector3d) return toVec(value);
    if (isArray(value) && value.elements.length >= 3)
      return new DVec3(...(value.elements.slice(0, 3).map(runtimeNumber) as [number, number, number]));
    throw new Error(`${name} requires a point/vector`);
  }

  vector(...names: string[]): DVec3 {
    return this.vectorValue(this.get(...names), names.join('/'));
  }

  frame(): Frame {
    const center = this.vector('center', 'centralPoint', 'centralPointD', 'start', 'pcF', 'cpF', 'cp');
    const normal = normalized(this.vector('normal', 'normalF', 'vector', 'vectorD', 'Vector', 'v'));
    if (length(normal) < 1e-9) throw new Error('zero normal');
    const value = this.get('upVector', 'upVectorD', 'upVectorF', 'radVect');
    const hint =
      value === undefined
        ? Math.abs(normal.z) < 0.9
          ? new DVec3(0, 0, 1)
          : new DVec3(0, 1, 0)
        : this.vectorValue(value, 'upVector');
    const [up] = basisFromUp(normal, hint);

    return { center, normal, up, right: normalized(cross(normal, up)) };
  }
}

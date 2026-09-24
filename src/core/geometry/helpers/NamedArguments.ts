import { cross, DVec3, length, normalized } from '../../../utils/DVec3';
import { apiSignatureMetadataForCall } from '../../runtime/ApiMetadata';
import { FdPoint3d, FdVector3d } from '../../runtime/FdMath';
import { isArray, runtimeNumber, runtimeTruthy, type RuntimeValue } from '../../runtime/RuntimeValue';
import { basisFromUp, toVec } from './geometryMath';
import type { MeshBuildContext } from '../MeshBuildContext';

/** Read by the selected overload's formal names, including SDK default arguments. */
export class NamedArguments {
  private values = new Map<string, RuntimeValue>();

  constructor(context: MeshBuildContext, args: RuntimeValue[]) {
    const signature = apiSignatureMetadataForCall(context.call);
    if (!signature) throw new Error('no matching SDK overload');
    signature.parameters.forEach((p, i) => this.values.set(p.name, args[i]));
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

  frame(): { center: DVec3; normal: DVec3; up: DVec3; right: DVec3 } {
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

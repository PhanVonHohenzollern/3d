import { CppException, doubleToInt64, formatFixed } from '@engine/runtime/cpp/cpp';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import type { BowlValue } from '@engine/runtime/FdBowlData';

// The interpreter's value model, with nothing that depends on the value-type registry: the
// registry's types build on this module, and RuntimeValue.ts adds the operations that need them.

export class RuntimeArray {
  constructor(
    public elementType = '',
    public dimensions: number[] = [],
    public elements: RuntimeValue[] = [],
  ) {}
}

export class RuntimeStdVector extends RuntimeArray {
  constructor(elementType: string, elements: RuntimeValue[] = []) {
    super(elementType, [elements.length], elements);
  }
}

export function stdVectorElementType(type: string): string | undefined {
  return /^std::vector<(.+)>$/.exec(type)?.[1];
}

export type RuntimeValue =
  undefined | number | bigint | boolean | string | FdPoint3d | FdVector3d | RuntimeArray | BowlValue;

export const isUnset = (v: RuntimeValue): v is undefined => v === undefined;

export const isDouble = (v: RuntimeValue): v is number => typeof v === 'number';

export const isInt = (v: RuntimeValue): v is bigint => typeof v === 'bigint';

export const isBool = (v: RuntimeValue): v is boolean => typeof v === 'boolean';

export const isString = (v: RuntimeValue): v is string => typeof v === 'string';

export const isPoint = (v: RuntimeValue): v is FdPoint3d => v instanceof FdPoint3d;

export const isVector = (v: RuntimeValue): v is FdVector3d => v instanceof FdVector3d;

export const isArray = (v: RuntimeValue): v is RuntimeArray => v instanceof RuntimeArray;

export function formatNumber(value: number): string {
  if (Math.abs(value) < 1e-12) value = 0.0;
  let s = formatFixed(value, 6);
  while (s.length > 1 && s.endsWith('0')) s = s.slice(0, -1);
  if (s.endsWith('.')) s = s.slice(0, -1);

  return s;
}

function arrayTypeName(a: RuntimeArray): string {
  let result = a.elementType === '' ? 'array' : a.elementType;
  for (const d of a.dimensions) result += `[${d}]`;

  return result;
}

export function runtimeTypeName(value: RuntimeValue): string {
  if (value instanceof RuntimeStdVector) return `std::vector<${value.elementType}>`;
  if (isDouble(value)) return 'double';
  if (isInt(value)) return 'int';
  if (isBool(value)) return 'bool';
  if (isString(value)) return 'string';
  if (isArray(value)) return arrayTypeName(value);
  // SDK value objects (FdPoint3d, FdBowlInfo, ...) carry their own type name.
  if (value !== undefined) return value.typeName;

  return 'unknown';
}

export function runtimeNumber(value: RuntimeValue): number {
  if (isDouble(value)) return value;
  if (isInt(value)) return Number(value);
  if (isBool(value)) return value ? 1.0 : 0.0;
  throw new CppException('runtime_error', `numeric value required, got ${runtimeTypeName(value)}`);
}

export function runtimeInteger(value: RuntimeValue): bigint {
  if (isInt(value)) return value;
  if (isDouble(value)) return doubleToInt64(value);
  if (isBool(value)) return value ? 1n : 0n;
  throw new CppException('runtime_error', `integer value required, got ${runtimeTypeName(value)}`);
}

export function runtimeTruthy(value: RuntimeValue): boolean {
  if (isBool(value)) return value;
  if (isDouble(value)) return value !== 0.0;
  if (isInt(value)) return value !== 0n;
  if (isString(value)) return true;
  if (isPoint(value) || isVector(value)) return true;
  if (isArray(value)) return true;

  return false;
}

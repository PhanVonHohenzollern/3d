import { CppException, doubleToInt64, formatFixed } from '../../utils/cpp';
import { FdPoint3d, FdVector3d } from './FdMath';
import { sdkCanonicalType } from './SdkDefinitions';

export class RuntimeArray {
  constructor(
    public elementType = '',
    public dimensions: number[] = [],
    public elements: RuntimeValue[] = [],
  ) {}
}

export type RuntimeValue = undefined | number | bigint | boolean | string | FdPoint3d | FdVector3d | RuntimeArray;

export const isUnset = (v: RuntimeValue): v is undefined => v === undefined;

export const isDouble = (v: RuntimeValue): v is number => typeof v === 'number';

export const isInt = (v: RuntimeValue): v is bigint => typeof v === 'bigint';

export const isBool = (v: RuntimeValue): v is boolean => typeof v === 'boolean';

export const isString = (v: RuntimeValue): v is string => typeof v === 'string';

export const isPoint = (v: RuntimeValue): v is FdPoint3d => v instanceof FdPoint3d;

export const isVector = (v: RuntimeValue): v is FdVector3d => v instanceof FdVector3d;

export const isArray = (v: RuntimeValue): v is RuntimeArray => v instanceof RuntimeArray;

function formatNumber(value: number): string {
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
  if (isDouble(value)) return 'double';
  if (isInt(value)) return 'int';
  if (isBool(value)) return 'bool';
  if (isString(value)) return 'string';
  if (isPoint(value)) return 'FdPoint3d';
  if (isVector(value)) return 'FdVector3d';
  if (isArray(value)) return arrayTypeName(value);

  return 'unknown';
}

export function runtimeValueToCompactString(value: RuntimeValue): string {
  if (isDouble(value)) return formatNumber(value);
  if (isInt(value)) return value.toString();
  if (isBool(value)) return value ? 'true' : 'false';
  if (isString(value)) return `"${value}"`;
  if (isPoint(value) || isVector(value))
    return `(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
  if (isArray(value)) {
    let s = '{';
    const limit = Math.min(value.elements.length, 8);
    for (let i = 0; i < limit; ++i) {
      if (i) s += ', ';
      s += runtimeValueToCompactString(value.elements[i]);
    }
    if (value.elements.length > limit) s += ', ...';
    s += '}';

    return s;
  }

  return '<unset>';
}

export function runtimeValueToString(value: RuntimeValue): string {
  return runtimeValueToCompactString(value);
}

export function runtimeDefaultValueForType(requestedType: string): RuntimeValue {
  const typeName = sdkCanonicalType(requestedType);
  if (typeName === 'double' || typeName === 'float' || typeName === 'ads_real') return 0.0;
  if (typeName === 'int' || typeName === 'short' || typeName === 'long') return 0n;
  if (typeName === 'bool') return false;
  if (typeName === 'char*' || typeName === 'const char*' || typeName === 'string') return '';
  if (typeName === 'FdPoint3d') return new FdPoint3d();
  if (typeName === 'FdVector3d') return new FdVector3d();

  return undefined;
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
  if (isString(value)) return value !== '';
  if (isPoint(value) || isVector(value)) return true;
  if (isArray(value)) return true;

  return false;
}

export function runtimeCoerceToType(value: RuntimeValue, requestedType: string): RuntimeValue {
  const typeName = sdkCanonicalType(requestedType);
  if (typeName === 'double' || typeName === 'float' || typeName === 'ads_real') return runtimeNumber(value);
  if (typeName === 'int' || typeName === 'short' || typeName === 'long') return runtimeInteger(value);
  if (typeName === 'bool') return runtimeTruthy(value);
  if (typeName === 'char*' || typeName === 'const char*' || typeName === 'string') {
    if (isString(value)) return value;

    return runtimeValueToCompactString(value);
  }
  if (typeName === 'FdPoint3d') {
    if (isPoint(value)) return value;
    throw new CppException('runtime_error', 'FdPoint3d value required');
  }
  if (typeName === 'FdVector3d') {
    if (isVector(value)) return value;
    throw new CppException('runtime_error', 'FdVector3d value required');
  }

  return value;
}

export function runtimeDeepCopy(value: RuntimeValue): RuntimeValue {
  if (isArray(value))
    return new RuntimeArray(value.elementType, [...value.dimensions], value.elements.map(runtimeDeepCopy));

  return value;
}

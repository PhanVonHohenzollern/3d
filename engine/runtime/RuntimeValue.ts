import { CppException } from '@engine/runtime/cpp/cpp';
import { sdkCanonicalType } from '@engine/runtime/SdkDefinitions';
import {
  formatNumber,
  isArray,
  isBool,
  isDouble,
  isInt,
  isString,
  RuntimeArray,
  runtimeInteger,
  runtimeNumber,
  RuntimeStdVector,
  runtimeTruthy,
  stdVectorElementType,
  type RuntimeValue,
} from '@engine/runtime/values/core';
import { valueTypeConstructedBy, valueTypeNamed, valueTypeOf } from '@engine/runtime/values/registry';
import type { ValueOps } from '@engine/runtime/values/types';

export {
  isArray,
  isBool,
  isDouble,
  isInt,
  isPoint,
  isString,
  isUnset,
  isVector,
  RuntimeArray,
  runtimeInteger,
  runtimeNumber,
  RuntimeStdVector,
  runtimeTruthy,
  runtimeTypeName,
  stdVectorElementType,
  type RuntimeValue,
} from '@engine/runtime/values/core';

export function runtimeValueToCompactString(value: RuntimeValue): string {
  if (isDouble(value)) return formatNumber(value);
  if (isInt(value)) return value.toString();
  if (isBool(value)) return value ? 'true' : 'false';
  if (isString(value)) return `"${value}"`;
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
  const type = valueTypeOf(value);
  if (type) return type.describe(value, kValueOps);

  return '<unset>';
}

export function runtimeValueToString(value: RuntimeValue): string {
  return runtimeValueToCompactString(value);
}

export function runtimeDefaultValueForType(requestedType: string): RuntimeValue {
  const elementType = stdVectorElementType(requestedType);
  if (elementType) return new RuntimeStdVector(elementType);
  const named = valueTypeNamed(requestedType);
  if (named) return named.create();
  const typeName = sdkCanonicalType(requestedType);
  if (typeName === 'double' || typeName === 'float' || typeName === 'ads_real') return 0.0;
  if (typeName === 'int' || typeName === 'short' || typeName === 'long') return 0n;
  if (typeName === 'bool') return false;
  if (typeName === 'char') return 0n;
  if (typeName === 'char*' || typeName === 'const char*' || typeName === 'string') return '';

  return valueTypeNamed(typeName)?.create();
}

export function runtimeCoerceToType(value: RuntimeValue, requestedType: string): RuntimeValue {
  const elementType = stdVectorElementType(requestedType);
  if (elementType) {
    if (!(value instanceof RuntimeStdVector) || value.elementType !== elementType)
      throw new CppException('runtime_error', requestedType + ' value required');

    return runtimeDeepCopy(value);
  }
  const typeName = sdkCanonicalType(requestedType);
  if (typeName === 'double' || typeName === 'float' || typeName === 'ads_real') return runtimeNumber(value);
  if (typeName === 'int' || typeName === 'short' || typeName === 'long') return runtimeInteger(value);
  if (typeName === 'bool') return runtimeTruthy(value);
  if (typeName === 'char*' || typeName === 'const char*' || typeName === 'string') {
    if (value === undefined || value === 0n) return undefined;
    if (isString(value) || isArray(value)) return value;

    return runtimeValueToCompactString(value);
  }
  const type = valueTypeNamed(typeName);

  return type?.coerce ? type.coerce(value) : value;
}

export function runtimeString(value: RuntimeValue): string {
  const text = isString(value)
    ? value
    : isArray(value)
      ? value.elements
          .map((item) => (isString(item) ? item : String.fromCharCode(Number(runtimeInteger(item)))))
          .join('')
      : undefined;
  if (text === undefined) throw new CppException('runtime_error', 'string or character array required');

  return text.split('\0')[0];
}

export function runtimeDeepCopy(value: RuntimeValue): RuntimeValue {
  const type = valueTypeOf(value);
  if (type?.copy) return type.copy(value);
  if (value instanceof RuntimeStdVector)
    return new RuntimeStdVector(value.elementType, value.elements.map(runtimeDeepCopy));
  if (isArray(value))
    return new RuntimeArray(value.elementType, [...value.dimensions], value.elements.map(runtimeDeepCopy));

  return value;
}

// `Name(args)` for an SDK value type or one of its aliases (FdPoint3d(1, 2, 3), AcGePoint3d(p));
// undefined when `name` constructs no value type.
export function runtimeValueConstructor(name: string): ((args: readonly RuntimeValue[]) => RuntimeValue) | undefined {
  const type = valueTypeConstructedBy(name);

  return type && ((args) => type.construct(args, kValueOps));
}

export const kValueOps: ValueOps = {
  coerce: runtimeCoerceToType,
  copy: runtimeDeepCopy,
  describe: runtimeValueToCompactString,
};

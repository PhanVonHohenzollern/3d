import {
  isArray,
  isBool,
  isDouble,
  isInt,
  isString,
  RuntimeArray,
  runtimeString,
  runtimeTypeName,
  runtimeValueToCompactString,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { stdException, stod, stoll, trim } from '@engine/runtime/cpp/cpp';
import { sdkCanonicalType } from '@engine/runtime/SdkDefinitions';

const isCharacterBuffer = (value: RuntimeValue): value is RuntimeArray =>
  isArray(value) && sdkCanonicalType(value.elementType) === 'char';

export function parameterType(value: RuntimeValue): string {
  return isCharacterBuffer(value) ? 'string' : runtimeTypeName(value);
}

export function parameterTextToValue(text: string, current: RuntimeValue): RuntimeValue {
  if (isCharacterBuffer(current)) {
    const count = current.elements.length;

    return new RuntimeArray(
      current.elementType,
      current.dimensions,
      Array.from({ length: count }, (_, i) => (i < count - 1 ? (text[i] ?? '\0') : '\0')),
    );
  }
  if (isString(current)) return text;
  if (isBool(current)) {
    const value = trim(text);
    if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
    if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;

    return current;
  }
  if (!isInt(current) && !isDouble(current)) return current;
  try {
    const value = trim(text);
    const parsed = isInt(current) ? stoll(value) : stod(value);
    if (parsed.used === value.length) return parsed.value;
  } catch (e) {
    stdException(e);
  }

  return current;
}

export function parameterDisplayText(value: RuntimeValue): string {
  if (isCharacterBuffer(value)) return runtimeString(value);
  const text = runtimeValueToCompactString(value);

  return isString(value) && text === '""' ? '' : text;
}

import {
  isArray,
  isBool,
  isDouble,
  isInt,
  isString,
  RuntimeArray,
  runtimeValueToCompactString,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { stdException, stod, stoll, trim } from '@engine/runtime/cpp/cpp';

export function parameterTextToValue(text: string, current: RuntimeValue): RuntimeValue {
  if (isArray(current) && ['char', 'WCHAR', 'wchar_t'].includes(current.elementType)) {
    const count = current.elements.length;

    return new RuntimeArray(
      current.elementType,
      current.dimensions,
      Array.from({ length: count }, (_, i) => text[i] ?? '\0'),
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
  const text = runtimeValueToCompactString(value);

  return isString(value) && text === '""' ? '' : text;
}

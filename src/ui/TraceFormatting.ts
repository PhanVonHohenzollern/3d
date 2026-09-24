// Helpers shared by ApiTracePanel.cpp and ApiHistoryDialog.cpp (each file
// has its own copy in an anonymous namespace in the C++ source).

import type { RuntimeArgumentTrace, RuntimeValueSource, RuntimeVariableChange } from '../runtime/RuntimeTypes';
import {
  isArray, isBool, isDouble, isInt, isPoint, isString, isUnset, isVector, runtimeNumber, runtimeValueToCompactString,
  type RuntimeValue,
} from '../runtime/RuntimeValue';

/** QRegularExpression("\\s+") without Unicode properties: ASCII whitespace. */
const kWhitespace = /[ \t\n\v\f\r]+/g;
const kNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const kLvalue = /^[ \t\n\v\f\r]*([A-Za-z_]\w*)(?:[ \t\n\v\f\r]*\[[^\]]+\])*(?:[ \t\n\v\f\r]*\.[xyz])?[ \t\n\v\f\r]*$/;

/** Literal expressions are omitted when they merely repeat the evaluated value. */
export function displayExpression(expression: string, value: RuntimeValue): string {
  const compact = expression.replace(kWhitespace, '');
  const evaluated = runtimeValueToCompactString(value).replace(kWhitespace, '');
  if (compact === evaluated) return '';
  if (kNumber.test(compact) && (isDouble(value) || isInt(value)) && Number(compact) === runtimeNumber(value)) return '';
  return expression;
}

/** std::variant::index() of a RuntimeValue. */
export function runtimeValueIndex(value: RuntimeValue): number {
  if (isUnset(value)) return 0;
  if (isDouble(value)) return 1;
  if (isInt(value)) return 2;
  if (isBool(value)) return 3;
  if (isString(value)) return 4;
  if (isPoint(value)) return 5;
  if (isVector(value)) return 6;
  if (isArray(value)) return 7;
  return -1;
}

/** name.substr(0, name.find_first_of("[.")) */
export function sourceRootName(name: string): string {
  const match = /[[.]/.exec(name);
  return match ? name.slice(0, match.index) : name;
}

/**
 * An indexed argument also captures its index variable. Match the lvalue's
 * root, not simply the first/only captured input or a coincident value.
 */
export function directSource(trace: RuntimeArgumentTrace, value: RuntimeValue): RuntimeValueSource | null {
  const match = kLvalue.exec(trace.expression);
  if (!match) return null;
  const root = match[1];
  for (const source of trace.sources)
    if (sourceRootName(source.name) === root && runtimeValueIndex(source.value) === runtimeValueIndex(value)) return source;
  return null;
}

/** Compound assignments are shown as name op (expression). */
export function changeExpression(change: RuntimeVariableChange): string {
  if (change.operation === '+=' || change.operation === '-=' || change.operation === '*=' || change.operation === '/=')
    return `${change.name}${change.operation.slice(0, 1)}(${change.expression})`;
  return change.expression;
}

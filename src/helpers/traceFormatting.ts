import type { RuntimeArgumentTrace, RuntimeValueSource, RuntimeVariableChange } from '../core/runtime/RuntimeTypes';
import {
  isArray,
  isBool,
  isDouble,
  isInt,
  isPoint,
  isString,
  isUnset,
  isVector,
  runtimeNumber,
  runtimeValueToCompactString,
  type RuntimeValue,
} from '../core/runtime/RuntimeValue';

const kWhitespace = /[ \t\n\v\f\r]+/g;
const kNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const kLvalue = /^[ \t\n\v\f\r]*([A-Za-z_]\w*)(?:[ \t\n\v\f\r]*\[[^\]]+\])*(?:[ \t\n\v\f\r]*\.[xyz])?[ \t\n\v\f\r]*$/;

export function displayExpression(expression: string, value: RuntimeValue): string {
  const compact = expression.replace(kWhitespace, '');
  const evaluated = runtimeValueToCompactString(value).replace(kWhitespace, '');
  if (compact === evaluated) return '';
  if (kNumber.test(compact) && (isDouble(value) || isInt(value)) && Number(compact) === runtimeNumber(value)) return '';
  return expression;
}

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

export function sourceRootName(name: string): string {
  const match = /[[.]/.exec(name);
  return match ? name.slice(0, match.index) : name;
}

export function directSource(trace: RuntimeArgumentTrace, value: RuntimeValue): RuntimeValueSource | null {
  const match = kLvalue.exec(trace.expression);
  if (!match) return null;
  const root = match[1];
  for (const source of trace.sources)
    if (sourceRootName(source.name) === root && runtimeValueIndex(source.value) === runtimeValueIndex(value))
      return source;
  return null;
}

const isCompoundAssignment = (operation: string) =>
  operation === '+=' || operation === '-=' || operation === '*=' || operation === '/=';

export function compoundExpression(name: string, operation: string, expression: string): string {
  return isCompoundAssignment(operation) ? `${name}${operation.slice(0, 1)}(${expression})` : expression;
}

export function changeExpression(change: RuntimeVariableChange): string {
  return compoundExpression(change.name, change.operation, change.expression);
}

export function otherInputs(change: RuntimeVariableChange): RuntimeValueSource[] {
  return change.sources.filter((source) => source.name !== change.name || source.variableId !== change.variableId);
}

export function metadataTypeText(type: string): string {
  return type.split('const ').join('').split('&').join('').trim();
}

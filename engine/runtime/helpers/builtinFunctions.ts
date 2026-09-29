import { cppPow, cppRound, runtimeError } from '@engine/runtime/cpp/cpp';
import {
  isArray,
  isString,
  runtimeString,
  runtimeCoerceToType,
  runtimeDefaultValueForType,
  runtimeValueConstructor,
  runtimeNumber,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { isNumericType } from '@engine/runtime/helpers/typeNames';

export type BuiltinFunction = (args: readonly RuntimeValue[]) => RuntimeValue;

const numericConversion =
  (name: string): BuiltinFunction =>
  (args) => {
    if (args.length === 0) return runtimeDefaultValueForType(name);
    if (args.length !== 1) throw runtimeError(name + ' conversion requires one argument');

    return runtimeCoerceToType(args[0], name);
  };

const unary =
  (name: string, fn: (x: number) => number): BuiltinFunction =>
  (args) => {
    if (args.length !== 1) throw runtimeError(name + ' requires 1 argument');

    return fn(runtimeNumber(args[0]));
  };

const binary =
  (name: string, fn: (x: number, y: number) => number): BuiltinFunction =>
  (args) => {
    if (args.length !== 2) throw runtimeError(name + ' requires 2 arguments');

    return fn(runtimeNumber(args[0]), runtimeNumber(args[1]));
  };

const strcmp: BuiltinFunction = (args) => {
  if (args.length !== 2) throw runtimeError('strcmp requires 2 arguments');
  if (args.some((value) => !isString(value) && !isArray(value))) throw runtimeError('strcmp requires string arguments');
  const a = runtimeString(args[0]);
  const b = runtimeString(args[1]);

  return a === b ? 0n : a < b ? -1n : 1n;
};

const kMathFunctions: ReadonlyMap<string, BuiltinFunction> = new Map([
  ...(['min', 'max'] as const).map(
    (name) =>
      [
        name,
        (args: readonly RuntimeValue[]) => {
          if (args.length !== 2) throw runtimeError(name + ' requires two arguments');
          if (typeof args[0] === 'bigint' && typeof args[1] === 'bigint')
            return args[0] < args[1] === (name === 'min') ? args[0] : args[1];

          return (name === 'min' ? Math.min : Math.max)(runtimeNumber(args[0]), runtimeNumber(args[1]));
        },
      ] as [string, BuiltinFunction],
  ),
  ['sin', unary('sin', Math.sin)],
  ['cos', unary('cos', Math.cos)],
  ['tan', unary('tan', Math.tan)],
  ['asin', unary('asin', Math.asin)],
  ['acos', unary('acos', Math.acos)],
  ['atan', unary('atan', Math.atan)],
  ['atan2', binary('atan2', Math.atan2)],
  ['sqrt', unary('sqrt', Math.sqrt)],
  ['floor', unary('floor', Math.floor)],
  ['ceil', unary('ceil', Math.ceil)],
  ['round', unary('round', cppRound)],
  ['pow', binary('pow', cppPow)],
  ['abs', unary('abs', Math.abs)],
  ['fabs', unary('fabs', Math.abs)],
  ['strcmp', strcmp],
]);

export function builtinFunction(name: string): BuiltinFunction | undefined {
  if (name === 'strlen' || name === 'wcslen')
    return (args) => {
      if (args.length !== 1) throw runtimeError(name + ' requires one string');

      return BigInt(runtimeString(args[0]).length);
    };
  if (name === 'wcsstr' || name === 'strstr')
    return (args) => {
      if (args.length !== 2) throw runtimeError(name + ' requires two strings');

      const haystack = runtimeString(args[0]),
        index = haystack.indexOf(runtimeString(args[1]));

      return index < 0 ? undefined : haystack.slice(index);
    };
  const valueConstructor = runtimeValueConstructor(name);
  if (valueConstructor) return valueConstructor;
  if (isNumericType(name)) return numericConversion(name);

  return kMathFunctions.get(name);
}

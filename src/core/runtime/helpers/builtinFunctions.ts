import { cppPow, cppRound, runtimeError } from '../../../utils/cpp';
import { FdPoint3d, FdVector3d } from '../FdMath';
import {
  isString,
  runtimeCoerceToType,
  runtimeDefaultValueForType,
  runtimeNumber,
  type RuntimeValue,
} from '../RuntimeValue';
import { isNumericType } from './typeNames';

export type BuiltinFunction = (args: readonly RuntimeValue[]) => RuntimeValue;

const numericConversion =
  (name: string): BuiltinFunction =>
  (args) => {
    if (args.length === 0) return runtimeDefaultValueForType(name);
    if (args.length !== 1) throw runtimeError(name + ' conversion requires one argument');

    return runtimeCoerceToType(args[0], name);
  };

const pointOrVectorConstructor =
  (name: 'FdPoint3d' | 'FdVector3d'): BuiltinFunction =>
  (args) => {
    if (args.length === 0) return name === 'FdPoint3d' ? new FdPoint3d() : new FdVector3d();
    if (args.length === 1) return runtimeCoerceToType(args[0], name);
    if (args.length !== 3) throw runtimeError(name + ' constructor requires 0, 1 or 3 arguments');
    const x = runtimeNumber(args[0]),
      y = runtimeNumber(args[1]),
      z = runtimeNumber(args[2]);

    return name === 'FdPoint3d' ? new FdPoint3d(x, y, z) : new FdVector3d(x, y, z);
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
  const a = args[0];
  const b = args[1];
  if (!isString(a) || !isString(b)) throw runtimeError('strcmp requires string arguments');

  return a === b ? 0n : a < b ? -1n : 1n;
};

const kMathFunctions: ReadonlyMap<string, BuiltinFunction> = new Map([
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
  if (isNumericType(name)) return numericConversion(name);
  if (name === 'FdPoint3d' || name === 'FdVector3d') return pointOrVectorConstructor(name);

  return kMathFunctions.get(name);
}

import { runtimeError, wrapInt64 } from '../../../utils/cpp';
import { FdPoint3d } from '../FdMath';
import {
  isBool,
  isDouble,
  isInt,
  isPoint,
  isString,
  isVector,
  runtimeInteger,
  runtimeNumber,
  runtimeTypeName,
  type RuntimeValue,
} from '../RuntimeValue';

export function isNumeric(v: RuntimeValue): v is number | bigint | boolean {
  return isDouble(v) || isInt(v) || isBool(v);
}

export function addValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a + b);

    return runtimeNumber(a) + runtimeNumber(b);
  }
  if (isPoint(a) && isVector(b)) return a.add(b);
  if (isVector(a) && isPoint(b)) return b.add(a);
  if (isVector(a) && isVector(b)) return a.add(b);
  if (isString(a) && isString(b)) return a + b;
  throw runtimeError(`invalid operands for +: ${runtimeTypeName(a)} and ${runtimeTypeName(b)}`);
}

export function subValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a - b);

    return runtimeNumber(a) - runtimeNumber(b);
  }
  if (isPoint(a)) {
    const p: FdPoint3d = a;
    if (isVector(b)) return p.sub(b);
    if (isPoint(b)) return p.sub(b);
  }
  if (isVector(a) && isVector(b)) return a.sub(b);
  throw runtimeError(`invalid operands for -: ${runtimeTypeName(a)} and ${runtimeTypeName(b)}`);
}

export function mulValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a * b);

    return runtimeNumber(a) * runtimeNumber(b);
  }
  if (isNumeric(a) && isVector(b)) return b.mul(runtimeNumber(a));
  if (isVector(a) && isNumeric(b)) return a.mul(runtimeNumber(b));
  throw runtimeError(`invalid operands for *: ${runtimeTypeName(a)} and ${runtimeTypeName(b)}`);
}

export function divValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  const divisor = runtimeNumber(b);
  if (divisor === 0.0) throw runtimeError('division by zero');
  if (isNumeric(a)) return runtimeNumber(a) / divisor;
  if (isVector(a)) return a.div(divisor);
  throw runtimeError('invalid operands for /');
}

export function modValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  const divisor = runtimeInteger(b);
  if (divisor === 0n) throw runtimeError('modulo by zero');

  return runtimeInteger(a) % divisor;
}

export function negateValue(v: RuntimeValue): RuntimeValue {
  if (isInt(v)) return wrapInt64(-v);
  if (isNumeric(v)) return -runtimeNumber(v);
  if (isVector(v)) return v.neg();
  throw runtimeError('invalid unary - operand');
}

export function equalValues(a: RuntimeValue, b: RuntimeValue): boolean {
  if (isNumeric(a) && isNumeric(b)) return runtimeNumber(a) === runtimeNumber(b);
  if (isString(a) && isString(b)) return a === b;
  if (isPoint(a) && isPoint(b)) return a.x === b.x && a.y === b.y && a.z === b.z;
  if (isVector(a) && isVector(b)) return a.x === b.x && a.y === b.y && a.z === b.z;

  return false;
}

export function compareValues(op: string, lhs: RuntimeValue, rhs: RuntimeValue): boolean {
  let a: number | string;
  let b: number | string;
  if (isNumeric(lhs) && isNumeric(rhs)) {
    a = runtimeNumber(lhs);
    b = runtimeNumber(rhs);
  } else if (isString(lhs) && isString(rhs)) {
    a = lhs;
    b = rhs;
  } else {
    throw runtimeError('invalid operands for comparison');
  }
  if (op === '<') return a < b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;

  return a >= b;
}

export const compoundOperation = (op: string, current: RuntimeValue, rhs: RuntimeValue): RuntimeValue => {
  if (op === '+=') return addValues(current, rhs);
  if (op === '-=') return subValues(current, rhs);
  if (op === '*=') return mulValues(current, rhs);

  return divValues(current, rhs);
};

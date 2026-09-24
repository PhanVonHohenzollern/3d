import { runtimeError } from '../../../utils/cpp';
import { FdPoint3d, FdVector3d } from '../FdMath';
import {
  isPoint,
  isVector,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeNumber,
  runtimeTypeName,
  type RuntimeArray,
  type RuntimeValue,
} from '../RuntimeValue';

export interface RuntimeValueSlot {
  get(): RuntimeValue;
  set(value: RuntimeValue): void;
}

export interface LValueRef {
  slot: RuntimeValueSlot;
  member: string;
  path: string;
}

export const mapSlot = (map: Map<string, RuntimeValue>, key: string): RuntimeValueSlot => ({
  get: () => map.get(key),
  set: (value) => {
    map.set(key, value);
  },
});

export const arraySlot = (array: RuntimeArray, index: number): RuntimeValueSlot => ({
  get: () => array.elements[index],
  set: (value) => {
    array.elements[index] = value;
  },
});

const kCoercedTypes: readonly string[] = ['double', 'int', 'bool', 'FdPoint3d', 'FdVector3d', 'string'];

export function readLValue(ref: LValueRef): RuntimeValue {
  const current = ref.slot.get();
  if (ref.member === '') return runtimeDeepCopy(current);
  if (!isPoint(current) && !isVector(current)) throw runtimeError('.x/.y/.z requires FdPoint3d or FdVector3d');
  if (ref.member === 'x') return current.x;
  if (ref.member === 'y') return current.y;
  return current.z;
}

export function writeLValue(ref: LValueRef, value: RuntimeValue): void {
  if (ref.member === '') {
    const type = runtimeTypeName(ref.slot.get());
    ref.slot.set(kCoercedTypes.includes(type) ? runtimeCoerceToType(value, type) : runtimeDeepCopy(value));
    return;
  }
  const n = runtimeNumber(value);
  const current = ref.slot.get();
  if (!isPoint(current) && !isVector(current)) throw runtimeError('.x/.y/.z requires FdPoint3d or FdVector3d');
  const x = ref.member === 'x' ? n : current.x;
  const y = ref.member === 'y' ? n : current.y;
  const z = ref.member !== 'x' && ref.member !== 'y' ? n : current.z;
  ref.slot.set(isPoint(current) ? new FdPoint3d(x, y, z) : new FdVector3d(x, y, z));
}

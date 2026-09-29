import { runtimeError } from '@engine/runtime/cpp/cpp';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import { sdkCanonicalType } from '@engine/runtime/SdkDefinitions';
import { memberValue } from '@engine/runtime/helpers/valueMethods';
import { valueTypeNamed, valueTypeOf } from '@engine/runtime/values/registry';
import {
  isPoint,
  isArray,
  isVector,
  kValueOps,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeNumber,
  runtimeTypeName,
  stdVectorElementType,
  type RuntimeArray,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';

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
  get: () => {
    const value = array.elements[index];

    return sdkCanonicalType(array.elementType) === 'char' && typeof value === 'string'
      ? BigInt(value.charCodeAt(0) || 0)
      : value;
  },
  set: (value) => {
    array.elements[index] = value;
  },
});

// A field of an SDK struct value (corner.vertex, corner.radii), including nested lvalues.
export function memberSlot(value: RuntimeValue, member: string): RuntimeValueSlot {
  // Validate even when the field is used only as an assignment target.
  memberValue(value, member);
  const field = valueTypeOf(value)?.members[member];

  return {
    get: () => memberValue(value, member),
    set: (next) => {
      if (!field?.set) throw runtimeError(`array member ${member} requires an element index`);
      field.set(value, next, kValueOps);
    },
  };
}

// A stored value keeps its type: assignments convert into scalars, std::vector and the value types
// that define a conversion (FdPoint3d, FdVector3d).
const kCoercedScalars: readonly string[] = ['double', 'int', 'bool', 'string'];

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
    const current = ref.slot.get();
    if (isArray(current) && isArray(value) && !stdVectorElementType(runtimeTypeName(current))) {
      current.elements = value.elements.map(runtimeDeepCopy);
      current.dimensions = [...value.dimensions];

      return;
    }
    const type = runtimeTypeName(current);
    ref.slot.set(
      kCoercedScalars.includes(type) || stdVectorElementType(type) || valueTypeNamed(type)?.coerce
        ? runtimeCoerceToType(value, type)
        : runtimeDeepCopy(value),
    );

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

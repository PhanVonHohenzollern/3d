import { runtimeError } from '@engine/runtime/cpp/cpp';
import {
  isArray,
  isPoint,
  isVector,
  kValueOps,
  runtimeDeepCopy,
  RuntimeStdVector,
  runtimeTypeName,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { valueTypeOf } from '@engine/runtime/values/registry';
import { stdVectorMethods } from '@engine/runtime/values/stdVector';

// value.method(args) on a copy of the value; methods that change their object are called on the
// stored value instead (see RuntimeExecutor's mutateValue).
export function callMethod(value: RuntimeValue, method: string, args: readonly RuntimeValue[]): RuntimeValue {
  if (value instanceof RuntimeStdVector) {
    const vectorMethod = stdVectorMethods[method];
    if (vectorMethod) return vectorMethod(value, args, kValueOps);
  }
  const type = valueTypeOf(value);
  const typeMethod = type?.methods[method];
  if (typeMethod) return typeMethod(value, args, kValueOps);
  throw runtimeError((type?.unsupportedMethod ?? 'unsupported method in expression: ') + method);
}

export function indexValue(value: RuntimeValue, index: bigint): RuntimeValue {
  if (typeof value === 'string') {
    if (index < 0n || index > BigInt(value.length)) throw runtimeError('string index out of range');

    return BigInt(value.charCodeAt(Number(index)) || 0);
  }
  if (isPoint(value) || isVector(value)) {
    if (index < 0n || index > 2n) throw runtimeError(`${runtimeTypeName(value)} index out of range`);

    return index === 0n ? value.x : index === 1n ? value.y : value.z;
  }
  if (!isArray(value)) throw runtimeError('indexing requires an array, FdPoint3d or FdVector3d');
  if (index < 0n || index >= BigInt(value.elements.length)) throw runtimeError('array index out of range');

  return runtimeDeepCopy(value.elements[Number(index)]);
}

export function memberValue(value: RuntimeValue, member: string): RuntimeValue {
  const field = valueTypeOf(value)?.members[member];
  if (field) return field.get(value);
  throw runtimeError('member .' + member + ' is not available on ' + runtimeTypeName(value));
}

import { runtimeError } from '@engine/runtime/cpp/cpp';
import { RuntimeStdVector, type RuntimeValue } from '@engine/runtime/values/core';
import type { ValueMethod } from '@engine/runtime/values/types';

// front() and back() name an element: they can be read, assigned through and chained
// (list.front().x = 1), so every caller resolves them to an index here.
export function isVectorEnd(value: RuntimeValue, member: string): value is RuntimeStdVector {
  return value instanceof RuntimeStdVector && (member === 'front' || member === 'back');
}

export function vectorEndIndex(vector: RuntimeStdVector, member: 'front' | 'back' | string): number {
  if (vector.elements.length === 0) throw runtimeError(`std::vector::${member} requires a non-empty vector`);

  return member === 'front' ? 0 : vector.elements.length - 1;
}

function noArguments(name: string, args: readonly RuntimeValue[]): void {
  if (args.length !== 0) throw runtimeError(`std::vector::${name} takes no arguments`);
}

export const stdVectorMethods: Readonly<Record<string, ValueMethod<RuntimeStdVector>>> = {
  size(vector, args) {
    noArguments('size', args);

    return BigInt(vector.elements.length);
  },
  empty(vector, args) {
    noArguments('empty', args);

    return vector.elements.length === 0;
  },
  front(vector, args, ops) {
    noArguments('front', args);

    return ops.copy(vector.elements[vectorEndIndex(vector, 'front')]);
  },
  back(vector, args, ops) {
    noArguments('back', args);

    return ops.copy(vector.elements[vectorEndIndex(vector, 'back')]);
  },
};

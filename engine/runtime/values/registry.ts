import type { RuntimeValue } from '@engine/runtime/values/core';
import { bowlCornerType, bowlFaceType, bowlInfoType } from '@engine/runtime/values/bowl';
import { pointType, vectorType } from '@engine/runtime/values/pointVector';
import type { ValueType } from '@engine/runtime/values/types';

// The registry calls a type's functions only with values its `is` accepts, so each type can be
// written for its own value class.
function registered<T extends RuntimeValue>(type: ValueType<T>): ValueType {
  return type as unknown as ValueType;
}

const kValueTypes: readonly ValueType[] = [
  registered(pointType),
  registered(vectorType),
  registered(bowlInfoType),
  registered(bowlFaceType),
  registered(bowlCornerType),
];

const kByName = new Map(kValueTypes.map((type) => [type.name, type]));
const kByConstructor = new Map(kValueTypes.flatMap((type) => type.constructorNames.map((name) => [name, type])));

export const kValueTypeNames: readonly string[] = kValueTypes.map((type) => type.name);

export function valueTypeNamed(name: string): ValueType | undefined {
  return kByName.get(name);
}

export function valueTypeConstructedBy(name: string): ValueType | undefined {
  return kByConstructor.get(name);
}

export function valueTypeOf(value: RuntimeValue): ValueType | undefined {
  return kValueTypes.find((type) => type.is(value));
}

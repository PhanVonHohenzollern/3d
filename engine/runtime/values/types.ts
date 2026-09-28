import type { RuntimeValue } from '@engine/runtime/values/core';

// The generic value operations a type may need (they depend on every registered type).
export interface ValueOps {
  coerce(value: RuntimeValue, type: string): RuntimeValue;
  copy(value: RuntimeValue): RuntimeValue;
  describe(value: RuntimeValue): string;
}

export type ValueMethod<T> = (value: T, args: readonly RuntimeValue[], ops: ValueOps) => RuntimeValue;

export interface ValueMember<T> {
  get(value: T): RuntimeValue;
  // Only for fields a script may assign (corner.vertex = p).
  set?(value: T, next: RuntimeValue, ops: ValueOps): void;
}

// Everything the interpreter knows about one SDK value type. Adding a type means writing one of
// these and listing it in the registry.
export interface ValueType<T extends RuntimeValue = RuntimeValue> {
  readonly name: string;
  // Names that construct it when called: the type name and any SDK aliases (AcGePoint3d).
  readonly constructorNames: readonly string[];
  is(value: RuntimeValue): value is T;
  create(): T;
  construct(args: readonly RuntimeValue[], ops: ValueOps): RuntimeValue;
  // Conversion when a value is stored into this type; without it the value is stored as is.
  coerce?(value: RuntimeValue): RuntimeValue;
  // Deep copy for mutable objects; immutable values are shared.
  copy?(value: T): T;
  describe(value: T, ops: ValueOps): string;
  readonly methods: Readonly<Record<string, ValueMethod<T>>>;
  readonly members: Readonly<Record<string, ValueMember<T>>>;
  // Methods change the object itself (bowls): they run on the stored value.
  readonly changedInPlace: boolean;
  // Members are fields that assignments go through (corner.radii[0] = r).
  readonly hasFields: boolean;
  // The error prefix for a method the type does not have.
  readonly unsupportedMethod: string;
}

import { readLValue, writeLValue, type LValueRef } from '@engine/runtime/helpers/lvalues';
import type { RuntimeValueSource } from '@engine/runtime/RuntimeTypes';
import { runtimeValueToCompactString, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';

export interface ValueChange {
  line: number;
  operation: string;
  expression: string;
  // Where the new value came from, captured just before the write.
  sources?: RuntimeValueSource[] | (() => RuntimeValueSource[]);
  // Leave no history entry when the value stayed the same (get_val, reference write-back).
  onlyIfChanged?: boolean;
  // 'replace' stores the new value as is; 'convert' converts it to the stored value's type.
  store?: 'convert' | 'replace';
}

// Reads the value at `ref`, writes `next(before)` there and records the change in the variable
// history. Returns the value after the write.
export function recordChange(
  state: RuntimeState,
  ref: LValueRef,
  change: ValueChange,
  next: (before: RuntimeValue) => RuntimeValue,
): RuntimeValue {
  const before = readLValue(ref);

  return write(state, ref, change, before, next(before));
}

// recordChange for a change that may not apply: when `next` returns null nothing is written and
// null is returned.
export function recordChangeIf(
  state: RuntimeState,
  ref: LValueRef,
  change: ValueChange,
  next: (before: RuntimeValue) => RuntimeValue | null,
): RuntimeValue | null {
  const before = readLValue(ref);
  const value = next(before);

  return value === null ? null : write(state, ref, change, before, value);
}

function write(
  state: RuntimeState,
  ref: LValueRef,
  change: ValueChange,
  before: RuntimeValue,
  value: RuntimeValue,
): RuntimeValue {
  const sources = typeof change.sources === 'function' ? change.sources() : (change.sources ?? []);
  if (change.store === 'replace') ref.slot.set(value);
  else writeLValue(ref, value);
  const after = readLValue(ref);
  if (!change.onlyIfChanged || runtimeValueToCompactString(before) !== runtimeValueToCompactString(after))
    state.recordVariableChange(change.line, ref.path, change.operation, change.expression, before, after, sources);

  return after;
}

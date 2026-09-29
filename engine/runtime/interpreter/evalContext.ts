import { runtimeError } from '@engine/runtime/cpp/cpp';
import type { RuntimeFunctionMacro } from '@engine/runtime/helpers/macros';
import type { Token } from '@engine/runtime/helpers/tokens';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

// What an expression can read and call. The parser itself changes nothing: assignments, calls and
// mutating methods go through the context's owner.
export interface EvalContext {
  lookupValue(name: string): RuntimeValue;
  functionMacro(name: string): RuntimeFunctionMacro | undefined;
  // Runs `evaluate` with these names bound (a function macro's parameters), then unbinds them.
  withBindings<T>(bindings: ReadonlyMap<string, RuntimeValue>, evaluate: () => T): T;
  // A call to a function the parser does not know itself (SDK or program functions).
  callFunction?(name: string, argGroups: readonly Token[][], line: number): RuntimeValue;
  // A mutating method on a named value, applied to the stored value.
  mutateValue?(target: readonly Token[], method: string, args: readonly RuntimeValue[], line: number): RuntimeValue;
  updateValue?(target: readonly Token[], op: string, prefix: boolean, line: number): RuntimeValue;
}

// For expressions that may use no variables at all (preprocessor #if conditions).
export const kNoVariables: EvalContext = {
  lookupValue: (name) => {
    throw runtimeError('unknown variable: ' + name);
  },
  functionMacro: () => undefined,
  withBindings: (_bindings, evaluate) => evaluate(),
};

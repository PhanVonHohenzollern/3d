import type { LValueRef } from '@engine/runtime/helpers/lvalues';
import type { Token } from '@engine/runtime/helpers/tokens';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import type { RuntimeParameterRequest } from '@engine/runtime/RuntimeTypes';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

// What an intrinsic may use from the interpreter that runs it.
export interface IntrinsicContext {
  readonly state: RuntimeState;
  evaluate(tokens: readonly Token[]): RuntimeValue;
  resolveLValue(tokens: readonly Token[]): LValueRef;
  parentApiIndex(): number;
}

export interface IntrinsicCall {
  name: string;
  // The arguments as written, split at top-level commas (not evaluated).
  argGroups: readonly Token[][];
  line: number;
}

// A scalar declaration found by source scanning, used as the default of a discovered parameter.
export interface StaticParameterDecl {
  type: string;
  defaultValue: string;
}

// An SDK function the interpreter implements itself instead of recording it as a geometry call.
//
// A `language` intrinsic is found before the program's own functions, so a helper with the same name
// cannot replace it (get_val, ASSERT). An `sdk` intrinsic is found after them, gets its arguments
// already evaluated, and a helper with its name wins (setpt, GetFlgSize).
export type Intrinsic = LanguageIntrinsic | SdkIntrinsic;

export interface LanguageIntrinsic {
  readonly kind: 'language';
  readonly names: readonly string[];
  // Global statements that read parameters still run when one function is previewed on its own.
  readonly readsParameters?: boolean;
  // `name(...);` as a statement, given the whole statement's tokens. 'call' continues as an ordinary
  // call after the intrinsic ran.
  statement?(ctx: IntrinsicContext, call: IntrinsicCall, tokens: readonly Token[]): 'done' | 'call';
  // `name(...)` inside an expression; null when these arguments are not the intrinsic's form.
  expression?(ctx: IntrinsicContext, call: IntrinsicCall): { value: RuntimeValue } | null;
  // The parameter requests these calls make, found in a statement's tokens without running it.
  discover?(
    tokens: readonly Token[],
    declarations: ReadonlyMap<string, StaticParameterDecl>,
  ): RuntimeParameterRequest[];
}

export interface SdkIntrinsic {
  readonly kind: 'sdk';
  readonly names: readonly string[];
  // Computes the call's value, in a statement or an expression. The call is not recorded.
  value?(ctx: IntrinsicContext, call: IntrinsicCall, args: readonly RuntimeValue[]): RuntimeValue;
  // Changes its arguments as a statement; the call is then recorded like any SDK call.
  update?(ctx: IntrinsicContext, call: IntrinsicCall, args: readonly RuntimeValue[]): void;
}

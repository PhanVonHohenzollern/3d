import type { LValueRef } from '@engine/runtime/helpers/lvalues';
import type { Token } from '@engine/runtime/helpers/tokens';
import type { EvalContext } from '@engine/runtime/interpreter/evalContext';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import type { Statement } from '@engine/runtime/interpreter/Statement';
import type { IntrinsicContext } from '@engine/runtime/intrinsics';
import type { RuntimeExecutionOptions } from '@engine/runtime/RuntimeTypes';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

export const kMaxIterations = 10000;
export const kMaxFunctionCallDepth = 64;

// Where control goes after a statement. A function call runs with a fresh one and restores the
// caller's afterwards.
export interface ControlFlow {
  returned: boolean;
  returnValue: RuntimeValue;
  breaking: boolean;
  continuing: boolean;
  loopDepth: number;
  switchDepth: number;
}

export function freshControlFlow(): ControlFlow {
  return { returned: false, returnValue: undefined, breaking: false, continuing: false, loopDepth: 0, switchDepth: 0 };
}

// One program run, shared by the statement, declaration and call executors. Each of them gets
// this at construction instead of reaching into the others.
export interface Execution {
  readonly state: RuntimeState;
  readonly options?: RuntimeExecutionOptions;
  // The editor's cursor line: statements after it do not run, except inside called functions.
  readonly maxLine: number;
  readonly functions: ReadonlyMap<string, readonly Statement[]>;
  flow: ControlFlow;
  callDepth: number;
  readonly evalContext: EvalContext;
  readonly intrinsics: IntrinsicContext;
  evaluate(tokens: readonly Token[]): RuntimeValue;
  resolveLValue(tokens: readonly Token[]): LValueRef;
  // The API call a program function was called from, for nested calls and their source lines.
  parentApiIndex(): number;
  pushParentApi(index: number): void;
  popParentApi(): void;
  // A statement's line, or the line of the call that runs the function it is in.
  lineOrCaller(line: number): number;

  executeBody(s: Statement, skipFunctions?: boolean): void;
  executeSimple(tokens: readonly Token[], line: number): void;
  evaluateAssignment(tokens: readonly Token[], line?: number): RuntimeValue;
  declare(tokens: readonly Token[], line: number, userVariables?: boolean): void;
  directInitializer(type: string, tail: readonly Token[]): RuntimeValue;
  call(
    name: string,
    argGroups: readonly Token[][],
    line: number,
    expression?: boolean,
    baseCall?: boolean,
  ): RuntimeValue;
}

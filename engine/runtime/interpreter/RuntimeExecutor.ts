import { runtimeError } from '@engine/runtime/cpp/cpp';
import {
  functionScope,
  functionSignature,
  requiredParameterCount,
  parameterName,
  signatureParameterList,
  evaluateFunctionInput,
} from '@engine/runtime/helpers/functionSignatures';
import type { LValueRef } from '@engine/runtime/helpers/lvalues';
import { isIdentifier, splitTopLevel, type Token } from '@engine/runtime/helpers/tokens';
import { parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { stdException } from '@engine/runtime/cpp/cpp';
import { DeclarationEvaluator } from '@engine/runtime/interpreter/DeclarationEvaluator';
import type { EvalContext } from '@engine/runtime/interpreter/evalContext';
import { freshControlFlow, type ControlFlow, type Execution } from '@engine/runtime/interpreter/execution';
import { evaluateExpression } from '@engine/runtime/interpreter/evaluator';
import { FunctionCalls } from '@engine/runtime/interpreter/FunctionCalls';
import { FunctionDebug } from '@engine/runtime/interpreter/FunctionDebug';
import { FunctionValidator } from '@engine/runtime/interpreter/FunctionValidator';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import { resolveLValue } from '@engine/runtime/interpreter/lvalueResolution';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import { StatementExecutor } from '@engine/runtime/interpreter/StatementExecutor';
import { StatementKind, type Statement } from '@engine/runtime/interpreter/Statement';
import { languageIntrinsic, type IntrinsicContext } from '@engine/runtime/intrinsics';
import type { RuntimeExecutionOptions } from '@engine/runtime/RuntimeTypes';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

// Runs a parsed program: picks the entry function, runs the global statements and then that
// function, with the statement, declaration and call executors sharing this Execution.
export class RuntimeExecutor implements Execution {
  readonly debug: FunctionDebug;
  flow: ControlFlow = freshControlFlow();
  callDepth = 0;
  readonly functions = new Map<string, Statement[]>();
  readonly evalContext: EvalContext;
  readonly intrinsics: IntrinsicContext;
  readonly #parentApiStack: number[] = [];
  readonly #statements = new StatementExecutor(this);
  readonly #declarations = new DeclarationEvaluator(this);
  readonly #calls = new FunctionCalls(this);

  constructor(
    readonly state: RuntimeState,
    readonly maxLine: number,
    private readonly fullProgram = false,
    readonly options?: RuntimeExecutionOptions,
  ) {
    this.debug = new FunctionDebug(options?.debugCall);
    this.evalContext = {
      lookupValue: (name) => state.lookupValue(name),
      functionMacro: (name) => state.functionMacro(name),
      withBindings: (bindings, evaluate) => state.withBindings(bindings, evaluate),
      callFunction: (name, args, line) => this.call(name, args, line, true),
      mutateValue: (target, method, args, line) => this.#statements.mutateStoredValue(target, method, args, line),
      updateValue: (target, op, prefix, line) => this.#statements.executeIncrement(op, target, line, prefix),
    };
    this.intrinsics = {
      state,
      evaluate: (tokens) => this.evaluate(tokens),
      resolveLValue: (tokens) => this.resolveLValue(tokens),
      parentApiIndex: () => this.parentApiIndex(),
    };
  }

  executeProgram(root: Statement): void {
    try {
      this.executeEntry(root);
    } finally {
      if (this.debug.apiIndex >= 0) this.state.debugApiIndex = this.debug.apiIndex;
    }
  }

  private executeEntry(root: Statement): void {
    for (const child of root.children) {
      if (child.kind !== StatementKind.Function || child.functionName === '') continue;
      const overloads = this.functions.get(child.functionName) ?? [];
      overloads.push(child);
      this.functions.set(child.functionName, overloads);
    }

    if (this.fullProgram) root.accept(new FunctionValidator(this), undefined);

    const explicit = this.options?.entryFunction;
    const selectedFunction =
      explicit === undefined
        ? this.fullProgram
          ? this.entryFunction(root)
          : this.selectFunction(root)
        : explicit === null
          ? null
          : this.functions
              .get(explicit)
              ?.find(
                (fn) =>
                  fn.body && (!this.options?.entrySignature || functionSignature(fn) === this.options.entrySignature),
              );
    if (explicit && !selectedFunction) throw runtimeError(`Function not found: ${explicit}`);
    if (!selectedFunction) {
      this.executeGlobals(root);

      return;
    }
    ++this.callDepth;
    this.executeGlobals(root);
    --this.callDepth;

    this.state.snapshotGlobals();
    this.state.enterFunctionScope(
      functionScope(selectedFunction, this.functions.get(selectedFunction.functionName)!, this.options),
    );
    this.initializeFunctionParameters(selectedFunction);
    if (selectedFunction.body) this.executeBody(selectedFunction.body);
  }

  private executeGlobals(root: Statement): void {
    for (const child of root.children) {
      if (this.flow.returned || this.flow.breaking || this.flow.continuing) break;
      if (child.kind === StatementKind.Function) continue;
      if (
        this.options?.isolated &&
        (child.kind !== StatementKind.Simple ||
          (!parseRuntimeType(child.tokens, 0) && !languageIntrinsic(child.tokens[0]?.text)?.readsParameters))
      )
        continue;
      this.state.snapshotGlobals();
      this.#statements.executeNode(child, false);
    }
  }

  private entryFunction(root: Statement): Statement | null {
    const functions = root.children.filter((child) => child.kind === StatementKind.Function && child.body);

    const callsIn = (statement: Statement): string[] => {
      const names: string[] = [];
      for (const tokens of [
        statement.tokens,
        statement.condition,
        statement.forInit,
        statement.forCondition,
        statement.forIncrement,
      ])
        tokens.forEach((token, index) => {
          if (tokens[index + 1]?.text === '(') names.push(token.text);
        });
      for (const child of [...statement.children, statement.body, statement.thenBranch, statement.elseBranch])
        if (child) names.push(...callsIn(child));

      return names;
    };

    const called = new Set(functions.flatMap((fn) => callsIn(fn).filter((name) => name !== fn.functionName)));
    // A script can call its own entry point after the definitions.
    if (
      root.children.some(
        (child) =>
          child.kind !== StatementKind.Function &&
          callsIn(child).some((name) => functions.some((fn) => fn.functionName === name)),
      )
    )
      return null;

    return (
      functions.find((fn) => fn.functionName === 'main') ??
      functions.find((fn) => requiredParameterCount(fn) === 0 && !called.has(fn.functionName)) ??
      functions.find((fn) => requiredParameterCount(fn) === 0) ??
      functions[0] ??
      null
    );
  }

  private selectFunction(root: Statement): Statement | null {
    let latestBeforeCursor: Statement | null = null;
    for (const child of root.children) {
      if (child.kind !== StatementKind.Function || !child.body || child.startLine > this.maxLine) continue;
      latestBeforeCursor = child;
      if (this.maxLine <= child.endLine) return child;
    }

    return latestBeforeCursor;
  }

  private initializeFunctionParameters(fn: Statement): void {
    const list = signatureParameterList(fn.signature);
    if (!list) return;
    for (const param of splitTopLevel(list, ',')) {
      if (param.length === 0 || (param.length === 1 && isIdentifier(param[0], 'void'))) continue;
      try {
        this.declare(param, fn.startLine, true);
        const name = parameterName(param);
        const configured = this.options?.arguments?.get(name);
        if (configured !== undefined) {
          const value = evaluateFunctionInput(param, Lexer.scanExpression(configured), (tokens) =>
            this.evaluate(tokens),
          );
          this.state.setVariable(name, value, true, fn.startLine, 'input', configured);
        }
      } catch (e) {
        if (this.options?.arguments?.has(parameterName(param)))
          this.state.addDiagnostic(fn.startLine, `${parameterName(param)}: ${stdException(e).message}`);
        else stdException(e);
      }
    }
  }

  // Execution: shared services.

  evaluate(tokens: readonly Token[]): RuntimeValue {
    return evaluateExpression(tokens, this.evalContext);
  }

  resolveLValue(tokens: readonly Token[]): LValueRef {
    return resolveLValue(tokens, this.state, (index) => this.evaluate(index));
  }

  parentApiIndex(): number {
    return this.#parentApiStack.at(-1) ?? -1;
  }

  pushParentApi(index: number): void {
    this.#parentApiStack.push(index);
  }

  popParentApi(): void {
    this.#parentApiStack.pop();
  }

  lineOrCaller(line: number): number {
    return line || this.state.apiCall(this.parentApiIndex())?.line || 1;
  }

  executeBody(s: Statement, skipFunctions = true): void {
    this.#statements.executeBody(s, skipFunctions);
  }

  executeSimple(tokens: readonly Token[], line: number): void {
    this.#statements.executeSimple(tokens, line);
  }

  evaluateAssignment(tokens: readonly Token[], line = 0): RuntimeValue {
    return this.#statements.evaluateAssignment(tokens, line);
  }

  declare(tokens: readonly Token[], line: number, userVariables = true): void {
    this.#declarations.declare(tokens, line, userVariables);
  }

  directInitializer(type: string, tail: readonly Token[]): RuntimeValue {
    return this.#declarations.directInitializer(type, tail);
  }

  call(name: string, argGroups: readonly Token[][], line: number, expression = false, baseCall = false): RuntimeValue {
    return this.#calls.call(name, argGroups, line, expression, baseCall);
  }
}

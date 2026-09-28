import { runtimeError, stdException } from '@engine/runtime/cpp/cpp';
import { isBraceList } from '@engine/runtime/helpers/arrays';
import { parameterName } from '@engine/runtime/helpers/functionSignatures';
import { readLValue, type LValueRef } from '@engine/runtime/helpers/lvalues';
import { isMutatingMethod, mutatedValue, mutatingMethodDot } from '@engine/runtime/helpers/mutatingMethods';
import {
  findTopLevelAssignment,
  isIdentifier,
  isSymbol,
  parseCallArguments,
  sliceTokens,
  splitTopLevel,
  TokKind,
  tokensToExpression,
  tokensToText,
  type Token,
} from '@engine/runtime/helpers/tokens';
import { isKnownSdkTypedef, parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { callMethod } from '@engine/runtime/helpers/valueMethods';
import { addValues, compoundOperation } from '@engine/runtime/helpers/valueOperations';
import { recordChange, recordChangeIf } from '@engine/runtime/interpreter/changes';
import { kMaxIterations, type Execution } from '@engine/runtime/interpreter/execution';
import { StatementKind, type Statement } from '@engine/runtime/interpreter/Statement';
import { isBaseClassCall, languageIntrinsic } from '@engine/runtime/intrinsics';
import {
  isArray,
  runtimeDeepCopy,
  runtimeInteger,
  runtimeTruthy,
  runtimeTypeName,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { valueTypeOf } from '@engine/runtime/values/registry';

// Runs statements: blocks, control flow, simple statements (declarations, assignments, increments,
// method calls, free calls) and the loop and switch bookkeeping.
export class StatementExecutor {
  constructor(private readonly x: Execution) {}

  executeBody(s: Statement, skipFunctions = true): void {
    for (const child of s.children) {
      if (this.x.flow.returned || this.x.flow.breaking || this.x.flow.continuing) break;
      if (skipFunctions && child.kind === StatementKind.Function) continue;
      this.executeNode(child, skipFunctions);
    }
  }

  private safeExecute(s: Statement, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.x.state.addDiagnostic(this.x.lineOrCaller(s.startLine), stdException(e).message);
    }
  }

  executeNode(s: Statement, skipFunctions = true): void {
    if (this.x.flow.returned || this.x.flow.breaking || this.x.flow.continuing) return;
    if (this.x.callDepth === 0 && s.startLine > this.x.maxLine) return;
    switch (s.kind) {
      case StatementKind.Block:
        this.x.state.pushScope();
        try {
          this.executeBody(s, skipFunctions);
        } finally {
          // Keep the active block's locals visible when debugging inside it.
          if (this.x.callDepth > 0 || this.x.maxLine >= s.endLine) this.x.state.popScope();
        }
        break;
      case StatementKind.Simple:
        if (this.x.callDepth > 0 || s.endLine <= this.x.maxLine)
          this.safeExecute(s, () => this.executeSimple(s.tokens, s.startLine));
        break;
      case StatementKind.If:
        this.safeExecute(s, () => {
          const branch = runtimeTruthy(this.x.evaluate(s.condition)) ? s.thenBranch : s.elseBranch;
          if (branch) this.executeNode(branch);
        });
        break;
      case StatementKind.For:
        this.x.state.pushScope();
        try {
          this.safeExecute(s, () => this.executeFor(s));
        } finally {
          if (this.x.callDepth > 0 || this.x.maxLine >= s.endLine) this.x.state.popScope();
        }
        break;
      case StatementKind.While:
      case StatementKind.Do:
        this.safeExecute(s, () => this.executeLoop(s));
        break;
      case StatementKind.Switch:
        this.safeExecute(s, () => this.executeSwitch(s));
        break;
    }
  }

  private executeFor(s: Statement): void {
    const range = splitTopLevel(s.forInit, ':');
    if (range.length === 2 && !s.forCondition.length && !s.forIncrement.length) {
      const name = parameterName(range[0]),
        isReference = range[0].some((token) => token.text === '&');
      const target = this.x.resolveLValue(range[1]),
        values = target.slot.get();
      if (!isArray(values)) throw runtimeError('range-for requires an array');
      const saved = this.x.state.saveBinding(name);
      ++this.x.flow.loopDepth;
      try {
        for (let i = 0; i < values.elements.length; ++i) {
          if (i >= kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
          this.x.state.setVariable(name, values.elements[i], false, s.startLine, 'bind', tokensToExpression(range[1]));
          if (s.body) this.executeNode(s.body);
          if (isReference) values.elements[i] = this.x.state.lookupValue(name);
          if (this.x.flow.returned || this.x.flow.breaking) break;
          this.x.flow.continuing = false;
        }
      } finally {
        --this.x.flow.loopDepth;
        this.x.flow.breaking = this.x.flow.continuing = false;
        this.x.state.restoreBinding(name, saved);
      }

      return;
    }
    if (s.forInit.length !== 0) this.executeSimple(s.forInit, s.startLine);
    let count = 0;
    ++this.x.flow.loopDepth;
    try {
      while (s.forCondition.length === 0 || runtimeTruthy(this.x.evaluate(s.forCondition))) {
        if (++count > kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
        if (s.body) this.executeNode(s.body);
        if (this.x.flow.returned) return;
        if (this.x.flow.breaking) break;
        this.x.flow.continuing = false;
        if (s.forIncrement.length !== 0) this.executeSimple(s.forIncrement, s.startLine);
      }
    } finally {
      --this.x.flow.loopDepth;
      this.x.flow.breaking = false;
      this.x.flow.continuing = false;
    }
  }

  private executeLoop(s: Statement): void {
    let count = 0;
    ++this.x.flow.loopDepth;
    try {
      while ((s.kind === StatementKind.Do && count === 0) || runtimeTruthy(this.x.evaluate(s.condition))) {
        if (++count > kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
        if (s.body) this.executeNode(s.body);
        if (this.x.flow.returned || this.x.flow.breaking) break;
        this.x.flow.continuing = false;
      }
    } finally {
      --this.x.flow.loopDepth;
      this.x.flow.breaking = false;
      this.x.flow.continuing = false;
    }
  }

  private executeSwitch(s: Statement): void {
    const value = runtimeInteger(this.x.evaluate(s.condition));
    const cases = s.body?.children.filter((child) => child.kind === StatementKind.Case) ?? [];
    let index = cases.findIndex(
      (child) => child.condition.length > 0 && runtimeInteger(this.x.evaluate(child.condition)) === value,
    );
    if (index < 0) index = cases.findIndex((child) => child.condition.length === 0);
    if (index < 0) return;
    ++this.x.flow.switchDepth;
    try {
      for (const child of cases.slice(index)) {
        if (child.body) this.executeNode(child.body);
        if (this.x.flow.returned || this.x.flow.breaking || this.x.flow.continuing) break;
      }
    } finally {
      --this.x.flow.switchDepth;
      this.x.flow.breaking = false;
    }
  }

  executeSimple(tokens: readonly Token[], line: number): void {
    line = this.x.lineOrCaller(line);
    if (tokens.length === 0) return;
    const expressions = splitTopLevel(tokens, ',');
    if (expressions.length > 1 && !parseRuntimeType(tokens, 0)) {
      for (const expression of expressions) this.executeSimple(expression, line);

      return;
    }
    if (isIdentifier(tokens[0], 'return')) {
      this.x.flow.returnValue = tokens.length > 1 ? this.x.evaluate(tokens.slice(1)) : undefined;
      this.x.flow.returned = true;

      return;
    }
    if (isIdentifier(tokens[0], 'break')) {
      if (this.x.flow.loopDepth === 0 && this.x.flow.switchDepth === 0)
        throw runtimeError('break outside loop or switch');
      this.x.flow.breaking = true;

      return;
    }
    if (isIdentifier(tokens[0], 'continue')) {
      if (this.x.flow.loopDepth === 0) throw runtimeError('continue outside loop');
      this.x.flow.continuing = true;

      return;
    }
    if (isIdentifier(tokens[0], 'delete')) return;
    if (isIdentifier(tokens[0], 'typedef')) {
      if (isKnownSdkTypedef(tokens)) return;
      throw runtimeError('unsupported typedef (only known SDK type definitions are available)');
    }
    const declaredType = parseRuntimeType(tokens, 0);
    const namePosition = declaredType?.end ?? -1;
    if (
      namePosition >= 0 &&
      this.x.functions.has(tokens[namePosition]?.text) &&
      tokens[namePosition + 1]?.text === '(' &&
      tokens.at(-1)?.text === ')'
    ) {
      const parameters = splitTopLevel(tokens.slice(namePosition + 2, -1), ',');
      if (parameters.every((p) => !p.length || p[0].text === 'void' || parseRuntimeType(p, 0))) return;
    }
    if (declaredType) {
      this.x.declare(tokens, line);

      return;
    }
    if (tokens.length >= 2 && tokens[0].kind === TokKind.Identifier && tokens[1].kind === TokKind.Identifier) {
      this.x.state.setVariable(tokens[1].text, undefined, true, line, 'declare', tokensToExpression(tokens));

      return;
    }
    if (this.executeIncrement(tokens, line)) return;
    if (findTopLevelAssignment(tokens)) {
      this.x.evaluateAssignment(tokens, line);

      return;
    }
    if (this.executeMutatingMethod(tokens, line)) return;
    if (this.executeFreeCall(tokens, line)) return;
    this.x.evaluate(tokens);
  }

  evaluateAssignment(tokens: readonly Token[], line = 0): RuntimeValue {
    const assignment = findTopLevelAssignment(tokens);
    if (!assignment) return this.x.evaluate(tokens);
    const { index, op } = assignment;
    const rhsTokens = sliceTokens(tokens, index + 1, tokens.length);
    const lhs = this.x.resolveLValue(sliceTokens(tokens, 0, index));
    const rhs =
      op === '=' && isBraceList(rhsTokens)
        ? this.x.directInitializer(runtimeTypeName(readLValue(lhs)), rhsTokens)
        : this.evaluateAssignment(rhsTokens, line);
    const state = this.x.state;

    return recordChange(
      state,
      lhs,
      {
        line,
        operation: op,
        expression: tokensToExpression(rhsTokens),
        sources: () => state.captureValueSources(tokensToExpression(tokens)),
      },
      (before) => (op === '=' ? rhs : compoundOperation(op, before, rhs)),
    );
  }

  private executeIncrement(tokens: readonly Token[], line: number): boolean {
    if (tokens.length < 2) return false;
    const last = tokens[tokens.length - 1].text;
    const prefix = tokens[0].text === '++' || tokens[0].text === '--';
    const postfix = last === '++' || last === '--';
    if (!prefix && !postfix) return false;
    const op = prefix ? tokens[0].text : last;
    const lvt = prefix ? sliceTokens(tokens, 1, tokens.length) : sliceTokens(tokens, 0, tokens.length - 1);
    const state = this.x.state;
    recordChange(
      state,
      this.x.resolveLValue(lvt),
      { line, operation: op, expression: '', sources: () => state.captureValueSources(tokensToExpression(lvt)) },
      (before) => addValues(before, op === '++' ? 1n : -1n),
    );

    return true;
  }

  private executeMutatingMethod(tokens: readonly Token[], line: number): boolean {
    const dot = mutatingMethodDot(tokens);
    if (dot === -1) return false;
    const method = tokens[dot + 1].text;
    if (!isMutatingMethod(method)) return this.executeBowlMethod(tokens, sliceTokens(tokens, 0, dot), line);
    const ref = this.x.resolveLValue(sliceTokens(tokens, 0, dot));
    if (ref.member !== '') throw runtimeError('method call on scalar member is invalid');
    const state = this.x.state;
    const after = recordChangeIf(
      state,
      ref,
      {
        line,
        operation: method,
        expression: tokensToExpression(tokens),
        sources: () => state.captureValueSources(tokensToExpression(tokens)),
        store: 'replace',
      },
      () => {
        const args = parseCallArguments(tokens, dot + 2).map((g) => this.x.evaluate(g));

        return mutatedValue(method, ref.slot.get(), args);
      },
    );

    return after !== null;
  }

  // `p.rotateBy(a, v)` inside an expression: the method runs on the stored value. Bowl objects are
  // changed in place by their own methods; the statement that contains the call records that.
  mutateStoredValue(
    target: readonly Token[],
    method: string,
    args: readonly RuntimeValue[],
    line: number,
  ): RuntimeValue {
    const ref = this.x.resolveLValue(target);
    const live = ref.member === '' ? ref.slot.get() : undefined;
    if (valueTypeOf(live)?.changedInPlace) return callMethod(live, method, args);

    return recordChange(
      this.x.state,
      ref,
      { line: this.x.lineOrCaller(line), operation: method, expression: tokensToExpression(target), store: 'replace' },
      (before) => {
        const next = mutatedValue(method, before, args);
        if (!next) throw runtimeError('invalid mutating method target');

        return next;
      },
    );
  }

  // A bowl method statement such as `info.setCovered(1)` or `infos[i].getFace(0).setCovered(1)`.
  // The receiver can be any lvalue path; the call itself goes through mutateStoredValue so it
  // reaches the stored object rather than a copy.
  private executeBowlMethod(tokens: readonly Token[], receiver: readonly Token[], line: number): boolean {
    if (receiver[0]?.kind !== TokKind.Identifier || !this.x.state.hasVariable(receiver[0].text)) return false;
    let ref: LValueRef;
    try {
      ref = this.x.resolveLValue(receiver);
    } catch {
      return false;
    }
    const target = ref.member === '' ? ref.slot.get() : undefined;
    if (!valueTypeOf(target)?.changedInPlace) return false;
    const before = runtimeDeepCopy(target);
    this.x.evaluate(tokens);
    this.x.state.recordVariableChange(line, ref.path, 'method', tokensToExpression(tokens), before, ref.slot.get());

    return true;
  }

  private executeFreeCall(tokens: readonly Token[], line: number): boolean {
    const lparen = tokens.findIndex((token) => token.text === '(');
    if (lparen < 1) return false;
    const baseCall = isBaseClassCall(tokensToText(tokens.slice(0, lparen)));
    if (baseCall) tokens = tokens.slice(lparen - 1);
    if (tokens.length < 2 || tokens[0].kind !== TokKind.Identifier || !isSymbol(tokens[1], '(')) return false;
    const name = tokens[0].text;
    const argGroups = parseCallArguments(tokens, 1);
    const intrinsic = languageIntrinsic(name);
    if (intrinsic?.statement?.(this.x.intrinsics, { name, argGroups, line }, tokens) === 'done') return true;
    this.x.call(name, argGroups, line, false, baseCall);

    return true;
  }
}

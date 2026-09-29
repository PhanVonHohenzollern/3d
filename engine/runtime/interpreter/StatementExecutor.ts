import { runtimeError, stdException } from '@engine/runtime/cpp/cpp';
import { isBraceList } from '@engine/runtime/helpers/arrays';
import { parameterName } from '@engine/runtime/helpers/functionSignatures';
import { readLValue, type LValueRef } from '@engine/runtime/helpers/lvalues';
import { isMutatingMethod, mutatedValue } from '@engine/runtime/helpers/mutatingMethods';
import { splitTopLevel, TokKind, tokensToExpression, type Token } from '@engine/runtime/helpers/tokens';
import { callMethod } from '@engine/runtime/helpers/valueMethods';
import { addValues, compoundOperation } from '@engine/runtime/helpers/valueOperations';
import { recordChange, recordChangeIf } from '@engine/runtime/interpreter/changes';
import { evaluateExpression } from '@engine/runtime/interpreter/evaluator';
import {
  assignmentParts,
  freeCallParts,
  methodCallParts,
  simpleStatement,
} from '@engine/runtime/interpreter/simpleStatements';
import { kMaxIterations, type Execution } from '@engine/runtime/interpreter/execution';
import { StatementKind, type Statement, type StatementVisitor } from '@engine/runtime/interpreter/Statement';
import { languageIntrinsic } from '@engine/runtime/intrinsics';
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
export class StatementExecutor implements StatementVisitor<void, boolean> {
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
    s.accept(this, skipFunctions);
  }

  visitBlock(s: Statement, skipFunctions: boolean): void {
    this.x.state.pushScope();
    try {
      this.executeBody(s, skipFunctions);
    } finally {
      // Keep the active block's locals visible when debugging inside it.
      if (this.x.callDepth > 0 || this.x.maxLine >= s.endLine) this.x.state.popScope();
    }
  }

  visitSimple(s: Statement): void {
    if (this.x.callDepth > 0 || s.endLine <= this.x.maxLine)
      this.safeExecute(s, () => this.executeSimple(s.tokens, s.startLine));
  }

  visitIf(s: Statement): void {
    this.safeExecute(s, () => {
      const branch = runtimeTruthy(this.x.evaluate(s.condition)) ? s.thenBranch : s.elseBranch;
      if (branch) this.executeNode(branch);
    });
  }

  visitFor(s: Statement): void {
    this.x.state.pushScope();
    try {
      this.safeExecute(s, () => this.executeFor(s));
    } finally {
      if (this.x.callDepth > 0 || this.x.maxLine >= s.endLine) this.x.state.popScope();
    }
  }

  visitWhile(s: Statement): void {
    this.safeExecute(s, () => this.executeLoop(s));
  }

  visitDo(s: Statement): void {
    this.visitWhile(s);
  }

  visitSwitch(s: Statement): void {
    this.safeExecute(s, () => this.executeSwitch(s));
  }

  visitFunction(): void {}

  visitEmpty(): void {}

  visitCase(): void {}

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
    const statement = simpleStatement(tokens, this.x.functions);
    switch (statement.kind) {
      case 'empty':
      case 'ignored':
        return;
      case 'list':
        for (const part of statement.parts) this.executeSimple(part, line);

        return;
      case 'return':
        this.x.flow.returnValue = statement.value ? this.x.evaluate(statement.value) : undefined;
        this.x.flow.returned = true;

        return;
      case 'break':
        if (this.x.flow.loopDepth === 0 && this.x.flow.switchDepth === 0)
          throw runtimeError('break outside loop or switch');
        this.x.flow.breaking = true;

        return;
      case 'continue':
        if (this.x.flow.loopDepth === 0) throw runtimeError('continue outside loop');
        this.x.flow.continuing = true;

        return;
      case 'unsupportedTypedef':
        throw runtimeError('unsupported typedef (only known SDK type definitions are available)');
      case 'declaration':
        this.x.declare(tokens, line);

        return;
      case 'untypedDeclaration':
        this.x.state.setVariable(statement.name, undefined, true, line, 'declare', statement.expression);

        return;
      case 'increment':
        this.executeIncrement(statement.op, statement.target, line);

        return;
      case 'assignment':
        this.x.evaluateAssignment(tokens, line);

        return;
      case 'other':
        if (this.executeMutatingMethod(tokens, line)) return;
        if (this.executeFreeCall(tokens, line)) return;
        this.x.evaluate(tokens);
    }
  }

  evaluateAssignment(tokens: readonly Token[], line = 0): RuntimeValue {
    const assignment = assignmentParts(tokens);
    if (!assignment) return this.x.evaluate(tokens);
    const { op, target, value } = assignment;
    const lhs = this.x.resolveLValue(target);
    if (op === '=' && target.length === 1 && this.x.state.isPointer(target[0].text)) {
      const next = evaluateExpression(value, {
        ...this.x.evalContext,
        lookupValue: (name) => this.x.state.lookupValue(name, false),
      });
      const before = readLValue(lhs);
      this.x.state.bindPointer(target[0].text, next);
      this.x.state.recordVariableChange(line, lhs.path, 'rebind', tokensToExpression(value), before, next);

      return next;
    }
    const rhs =
      op === '=' && isBraceList(value)
        ? this.x.directInitializer(runtimeTypeName(readLValue(lhs)), value)
        : this.evaluateAssignment(value, line);
    const state = this.x.state;

    return recordChange(
      state,
      lhs,
      {
        line,
        operation: op,
        expression: tokensToExpression(value),
        sources: () => state.captureValueSources(tokensToExpression(tokens)),
      },
      (before) => (op === '=' ? rhs : compoundOperation(op, before, rhs)),
    );
  }

  executeIncrement(op: string, target: readonly Token[], line: number, prefix = true): RuntimeValue {
    const state = this.x.state;
    const ref = this.x.resolveLValue(target);
    const before = readLValue(ref);
    const after = recordChange(
      state,
      ref,
      {
        line: this.x.lineOrCaller(line),
        operation: op,
        expression: '',
        sources: () => state.captureValueSources(tokensToExpression(target)),
      },
      (before) => addValues(before, op === '++' ? 1n : -1n),
    );

    return prefix ? after : before;
  }

  private executeMutatingMethod(tokens: readonly Token[], line: number): boolean {
    const call = methodCallParts(tokens);
    if (!call) return false;
    const { method, receiver, argGroups } = call;
    if (!isMutatingMethod(method)) return this.executeBowlMethod(tokens, receiver, line);
    const ref = this.x.resolveLValue(receiver);
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
      () =>
        mutatedValue(
          method,
          ref.slot.get(),
          argGroups.map((g) => this.x.evaluate(g)),
        ),
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
    const call = freeCallParts(tokens);
    if (!call) return false;
    const { name, argGroups } = call;
    const intrinsic = languageIntrinsic(name);
    if (intrinsic?.statement?.(this.x.intrinsics, { name, argGroups, line }, call.tokens) === 'done') return true;
    this.x.call(name, argGroups, line, false, call.baseCall);

    return true;
  }
}

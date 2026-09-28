import { runtimeError, stdException } from '@engine/runtime/cpp/cpp';
import { resolveApiSignature } from '@engine/runtime/ApiMetadata';
import { FdVector3d } from '@engine/runtime/FdMath';
import { createApiCall } from '@engine/runtime/helpers/apiCalls';
import { braceListItems, createArray, inferArrayDimensions, isBraceList } from '@engine/runtime/helpers/arrays';
import {
  functionParameters,
  functionSignature,
  functionScope,
  functionArgumentRanks,
  parameterDefaultExpression,
  parameterDefaultPos,
  parameterName,
  requiredParameterCount,
  populateFormalParameterMetadata,
  signatureParameterList,
  writableReferenceParameter,
} from '@engine/runtime/helpers/functionSignatures';
import {
  arraySlot,
  memberSlot,
  mapSlot,
  readLValue,
  writeLValue,
  type LValueRef,
} from '@engine/runtime/helpers/lvalues';
import { isMutatingMethod, mutatedValue, mutatingMethodDot } from '@engine/runtime/helpers/mutatingMethods';
import { callMethod } from '@engine/runtime/helpers/valueMethods';
import { valueTypeNamed, valueTypeOf } from '@engine/runtime/values/registry';
import { isVectorEnd, vectorEndIndex } from '@engine/runtime/values/stdVector';
import {
  findTopLevelAssignment,
  isIdentifier,
  isSymbol,
  matchingBracketEnd,
  parseCallArguments,
  sliceTokens,
  splitTopLevel,
  TokKind,
  tokensToExpression,
  tokensToText,
  type Token,
} from '@engine/runtime/helpers/tokens';
import { isKnownSdkTypedef, parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { addValues, compoundOperation } from '@engine/runtime/helpers/valueOperations';
import type { RuntimeArgumentTrace, RuntimeExecutionOptions, RuntimeValueSource } from '@engine/runtime/RuntimeTypes';
import {
  isArray,
  isPoint,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeDefaultValueForType,
  runtimeValueConstructor,
  runtimeInteger,
  runtimeTruthy,
  runtimeTypeName,
  runtimeValueToCompactString,
  RuntimeStdVector,
  stdVectorElementType,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { sdkTypeDefinition } from '@engine/runtime/SdkDefinitions';
import { rootName } from '@engine/runtime/helpers/variablePaths';
import { ExprParser } from '@engine/runtime/interpreter/ExprParser';
import { isBaseClassCall, languageIntrinsic, sdkIntrinsic, type IntrinsicContext } from '@engine/runtime/intrinsics';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import type { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import { StatementKind, type Statement } from '@engine/runtime/interpreter/Statement';

const kMaxIterations = 10000;
const kMaxFunctionCallDepth = 64;

interface ReferenceOutput {
  index: number;
  value: RuntimeValue;
  sources: RuntimeValueSource[];
}

export class RuntimeExecutor {
  private m_returned = false;
  private m_returnValue: RuntimeValue = undefined;
  private m_break = false;
  private m_continue = false;
  private m_loopDepth = 0;
  private m_switchDepth = 0;
  private m_functionCallDepth = 0;
  private readonly m_functions = new Map<string, Statement[]>();
  private readonly m_parentApiStack: number[] = [];
  #intrinsics: IntrinsicContext | undefined;

  constructor(
    private readonly m_state: RuntimeState,
    private readonly m_maxLine: number,
    private readonly m_fullProgram = false,
    private readonly m_options?: RuntimeExecutionOptions,
  ) {}

  executeProgram(root: Statement): void {
    this.m_state.callFunction = (name, args, line) => this.executeCall(name, args, line, true);
    this.m_state.mutateValue = (target, method, args, line) => {
      const ref = this.resolveLValue(target);
      // Bowl objects are changed in place by their own methods, so call them on the stored
      // object. The statement that contains the call records the change.
      const live = ref.member === '' ? ref.slot.get() : undefined;
      if (valueTypeOf(live)?.changedInPlace) return callMethod(live, method, args);
      const before = readLValue(ref),
        next = mutatedValue(method, before, args);
      if (!next) throw runtimeError('invalid mutating method target');
      ref.slot.set(next);
      this.m_state.recordVariableChange(
        line || this.m_state.m_apiCalls[this.parentApiIndex()]?.line || 1,
        ref.path,
        method,
        tokensToExpression(target),
        before,
        next,
      );

      return next;
    };
    for (const child of root.children) {
      if (child.kind !== StatementKind.Function || child.functionName === '') continue;
      const overloads = this.m_functions.get(child.functionName) ?? [];
      overloads.push(child);
      this.m_functions.set(child.functionName, overloads);
    }

    const explicit = this.m_options?.entryFunction;
    const selectedFunction =
      explicit === undefined
        ? this.m_fullProgram
          ? this.entryFunction(root)
          : this.selectFunction(root)
        : explicit === null
          ? null
          : this.m_functions
              .get(explicit)
              ?.find(
                (fn) => !this.m_options?.entrySignature || functionSignature(fn) === this.m_options.entrySignature,
              );
    if (explicit && !selectedFunction) throw runtimeError(`Function not found: ${explicit}`);
    if (!selectedFunction) {
      this.executeGlobals(root);

      return;
    }
    ++this.m_functionCallDepth;
    this.executeGlobals(root);
    --this.m_functionCallDepth;

    this.m_state.globalValues = new Map(this.m_state.m_values);
    this.m_state.globalIds = new Map(this.m_state.m_variableIds);
    this.m_state.functionName = functionScope(
      selectedFunction,
      this.m_functions.get(selectedFunction.functionName)!,
      this.m_options,
    );
    this.initializeFunctionParameters(selectedFunction);
    if (selectedFunction.body) this.executeBody(selectedFunction.body);
  }

  private executeGlobals(root: Statement): void {
    for (const child of root.children) {
      if (this.m_returned || this.m_break || this.m_continue) break;
      if (child.kind === StatementKind.Function) continue;
      if (
        this.m_options?.isolated &&
        (child.kind !== StatementKind.Simple ||
          (!parseRuntimeType(child.tokens, 0) && !languageIntrinsic(child.tokens[0]?.text)?.readsParameters))
      )
        continue;
      this.m_state.globalValues = new Map(this.m_state.m_values);
      this.m_state.globalIds = new Map(this.m_state.m_variableIds);
      this.executeNode(child, false);
    }
  }

  private entryFunction(root: Statement): Statement | null {
    const functions = root.children.filter((child) => child.kind === StatementKind.Function);

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

  private executeBody(s: Statement, skipFunctions = true): void {
    for (const child of s.children) {
      if (this.m_returned || this.m_break || this.m_continue) break;
      if (skipFunctions && child.kind === StatementKind.Function) continue;
      this.executeNode(child, skipFunctions);
    }
  }

  private selectFunction(root: Statement): Statement | null {
    let latestBeforeCursor: Statement | null = null;
    for (const child of root.children) {
      if (child.kind !== StatementKind.Function || child.startLine > this.m_maxLine) continue;
      latestBeforeCursor = child;
      if (this.m_maxLine <= child.endLine) return child;
    }

    return latestBeforeCursor;
  }

  private evaluate(tokens: readonly Token[]): RuntimeValue {
    return new ExprParser(tokens, this.m_state).parse();
  }

  private parentApiIndex(): number {
    return this.m_parentApiStack.at(-1) ?? -1;
  }

  private safeExecute(s: Statement, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.m_state.addDiagnostic(
        s.startLine || this.m_state.m_apiCalls[this.parentApiIndex()]?.line || 1,
        stdException(e).message,
      );
    }
  }

  private executeNode(s: Statement, skipFunctions = true): void {
    if (this.m_returned || this.m_break || this.m_continue) return;
    if (this.m_functionCallDepth === 0 && s.startLine > this.m_maxLine) return;
    switch (s.kind) {
      case StatementKind.Block:
        this.m_state.pushScope();
        try {
          this.executeBody(s, skipFunctions);
        } finally {
          // Keep the active block's locals visible when debugging inside it.
          if (this.m_functionCallDepth > 0 || this.m_maxLine >= s.endLine) this.m_state.popScope();
        }
        break;
      case StatementKind.Simple:
        if (this.m_functionCallDepth > 0 || s.endLine <= this.m_maxLine)
          this.safeExecute(s, () => this.executeSimple(s.tokens, s.startLine));
        break;
      case StatementKind.If:
        this.safeExecute(s, () => {
          const branch = runtimeTruthy(this.evaluate(s.condition)) ? s.thenBranch : s.elseBranch;
          if (branch) this.executeNode(branch);
        });
        break;
      case StatementKind.For:
        this.m_state.pushScope();
        try {
          this.safeExecute(s, () => this.executeFor(s));
        } finally {
          if (this.m_functionCallDepth > 0 || this.m_maxLine >= s.endLine) this.m_state.popScope();
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
      const target = this.resolveLValue(range[1]),
        values = target.slot.get();
      if (!isArray(values)) throw runtimeError('range-for requires an array');
      const saved = this.m_state.m_values.get(name),
        existed = this.m_state.m_values.has(name);
      ++this.m_loopDepth;
      try {
        for (let i = 0; i < values.elements.length; ++i) {
          if (i >= kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
          this.m_state.setVariable(name, values.elements[i], false, s.startLine, 'bind', tokensToExpression(range[1]));
          if (s.body) this.executeNode(s.body);
          if (isReference) values.elements[i] = runtimeDeepCopy(this.m_state.m_values.get(name));
          if (this.m_returned || this.m_break) break;
          this.m_continue = false;
        }
      } finally {
        --this.m_loopDepth;
        this.m_break = this.m_continue = false;
        if (existed) this.m_state.m_values.set(name, saved);
        else this.m_state.m_values.delete(name);
      }

      return;
    }
    if (s.forInit.length !== 0) this.executeSimple(s.forInit, s.startLine);
    let count = 0;
    ++this.m_loopDepth;
    try {
      while (s.forCondition.length === 0 || runtimeTruthy(this.evaluate(s.forCondition))) {
        if (++count > kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
        if (s.body) this.executeNode(s.body);
        if (this.m_returned) return;
        if (this.m_break) break;
        this.m_continue = false;
        if (s.forIncrement.length !== 0) this.executeSimple(s.forIncrement, s.startLine);
      }
    } finally {
      --this.m_loopDepth;
      this.m_break = false;
      this.m_continue = false;
    }
  }

  private executeLoop(s: Statement): void {
    let count = 0;
    ++this.m_loopDepth;
    try {
      while ((s.kind === StatementKind.Do && count === 0) || runtimeTruthy(this.evaluate(s.condition))) {
        if (++count > kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
        if (s.body) this.executeNode(s.body);
        if (this.m_returned || this.m_break) break;
        this.m_continue = false;
      }
    } finally {
      --this.m_loopDepth;
      this.m_break = false;
      this.m_continue = false;
    }
  }

  private executeSwitch(s: Statement): void {
    const value = runtimeInteger(this.evaluate(s.condition));
    const cases = s.body?.children.filter((child) => child.kind === StatementKind.Case) ?? [];
    let index = cases.findIndex(
      (child) => child.condition.length > 0 && runtimeInteger(this.evaluate(child.condition)) === value,
    );
    if (index < 0) index = cases.findIndex((child) => child.condition.length === 0);
    if (index < 0) return;
    ++this.m_switchDepth;
    try {
      for (const child of cases.slice(index)) {
        if (child.body) this.executeNode(child.body);
        if (this.m_returned || this.m_break || this.m_continue) break;
      }
    } finally {
      --this.m_switchDepth;
      this.m_break = false;
    }
  }

  private executeSimple(tokens: readonly Token[], line: number): void {
    line = line || this.m_state.m_apiCalls[this.parentApiIndex()]?.line || 1;
    if (tokens.length === 0) return;
    const expressions = splitTopLevel(tokens, ',');
    if (expressions.length > 1 && !parseRuntimeType(tokens, 0)) {
      for (const expression of expressions) this.executeSimple(expression, line);

      return;
    }
    if (isIdentifier(tokens[0], 'return')) {
      this.m_returnValue = tokens.length > 1 ? this.evaluate(tokens.slice(1)) : undefined;
      this.m_returned = true;

      return;
    }
    if (isIdentifier(tokens[0], 'break')) {
      if (this.m_loopDepth === 0 && this.m_switchDepth === 0) throw runtimeError('break outside loop or switch');
      this.m_break = true;

      return;
    }
    if (isIdentifier(tokens[0], 'continue')) {
      if (this.m_loopDepth === 0) throw runtimeError('continue outside loop');
      this.m_continue = true;

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
      this.m_functions.has(tokens[namePosition]?.text) &&
      tokens[namePosition + 1]?.text === '(' &&
      tokens.at(-1)?.text === ')'
    ) {
      const parameters = splitTopLevel(tokens.slice(namePosition + 2, -1), ',');
      if (parameters.every((p) => !p.length || p[0].text === 'void' || parseRuntimeType(p, 0))) return;
    }
    if (declaredType) {
      this.executeDeclaration(tokens, line);

      return;
    }
    if (tokens.length >= 2 && tokens[0].kind === TokKind.Identifier && tokens[1].kind === TokKind.Identifier) {
      this.m_state.setVariable(tokens[1].text, undefined, true, line, 'declare', tokensToExpression(tokens));

      return;
    }
    if (this.executeIncrement(tokens, line)) return;
    if (findTopLevelAssignment(tokens)) {
      this.evaluateAssignmentExpression(tokens, line);

      return;
    }
    if (this.executeMutatingMethod(tokens, line)) return;
    if (this.executeFreeCall(tokens, line)) return;
    this.evaluate(tokens);
  }

  private initializerValue(
    tokens: readonly Token[],
    type: string,
    dims: readonly number[],
    level: number,
  ): RuntimeValue {
    if (level >= dims.length)
      return isBraceList(tokens)
        ? this.directInitializer(type, tokens)
        : runtimeCoerceToType(this.evaluate(tokens), type);
    const array = createArray(type, dims, level);
    if (tokens.length === 0) return array;
    if (!isBraceList(tokens)) {
      if (dims[level] > 0) array.elements[0] = this.initializerValue(tokens, type, dims, level + 1);

      return array;
    }
    const parts = braceListItems(tokens);
    if (parts.at(-1)?.length === 0) parts.pop();
    let cursor = 0;

    const fill = (target: typeof array) => {
      for (let i = 0; i < target.elements.length && cursor < parts.length; ++i) {
        const child = target.elements[i];
        if (isArray(child)) {
          if (isBraceList(parts[cursor]))
            target.elements[i] = this.initializerValue(parts[cursor++], type, child.dimensions, 0);
          else fill(child);
        } else {
          const part = parts[cursor++];
          if (part.length)
            target.elements[i] = isBraceList(part)
              ? this.directInitializer(type, part)
              : runtimeCoerceToType(this.evaluate(part), type);
        }
      }
    };

    fill(array);

    return array;
  }

  private directInitializer(type: string, tail: readonly Token[]): RuntimeValue {
    const braces = isBraceList(tail);
    if (!braces && (tail.length < 2 || !isSymbol(tail[0], '(') || !isSymbol(tail[tail.length - 1], ')')))
      throw runtimeError('invalid direct initializer');
    const inner = sliceTokens(tail, 1, tail.length - 1);
    const args = splitTopLevel(inner, ',');
    if (braces && args.at(-1)?.length === 0) args.pop();
    if (braces && inner.length === 0) return runtimeDefaultValueForType(type);
    const elementType = stdVectorElementType(type);
    if (elementType) {
      if (inner.length === 0) return new RuntimeStdVector(elementType);
      if (braces)
        return new RuntimeStdVector(
          elementType,
          args.map((arg) =>
            runtimeDeepCopy(
              isBraceList(arg)
                ? this.directInitializer(elementType, arg)
                : runtimeCoerceToType(this.evaluate(arg), elementType),
            ),
          ),
        );
      const values = args.map((arg) => this.evaluate(arg));
      if (values.length === 1 && values[0] instanceof RuntimeStdVector) return runtimeCoerceToType(values[0], type);
      if (values.length < 1 || values.length > 2) throw runtimeError('unsupported constructor for ' + type);
      const array = createArray(elementType, [Number(runtimeInteger(values[0]))]);
      if (values.length === 2)
        array.elements = array.elements.map(() => runtimeDeepCopy(runtimeCoerceToType(values[1], elementType)));

      return new RuntimeStdVector(elementType, array.elements);
    }
    // An SDK value type: T v; T v(); T v(x, y, z); T v(other). Other argument counts fall through.
    const construct = runtimeValueConstructor(type);
    if (construct && (inner.length === 0 || args.length === 3 || valueTypeNamed(type)?.changedInPlace))
      return construct(inner.length ? args.map((arg) => this.evaluate(arg)) : []);
    if (args.length === 1) return runtimeCoerceToType(this.evaluate(args[0]), type);
    throw runtimeError('unsupported direct initializer for ' + type);
  }

  private arrayDimensions(declarator: readonly Token[], start: number): { dims: number[]; end: number } {
    const dims: number[] = [];
    let p = start;
    while (p < declarator.length && isSymbol(declarator[p], '[')) {
      const begin = p + 1;
      p = matchingBracketEnd(declarator, begin).end;
      const dimTokens = sliceTokens(declarator, begin, p);
      let n = 0;
      if (dimTokens.length !== 0) {
        const extent = runtimeInteger(this.evaluate(dimTokens));
        n = Number(extent > 0n ? extent : 0n);
      }
      dims.push(n);
      if (p < declarator.length && isSymbol(declarator[p], ']')) ++p;
    }

    return { dims, end: p };
  }

  private executeDeclaration(tokens: readonly Token[], line: number, userVariables = true): void {
    const parsed = parseRuntimeType(tokens, 0);
    if (!parsed) throw runtimeError('not a declaration');
    const alias = sdkTypeDefinition(parsed.type);
    const type = alias ? alias.baseType : parsed.type;
    for (const decl of splitTopLevel(sliceTokens(tokens, parsed.end, tokens.length), ',')) {
      if (decl.length === 0) continue;
      let p = 0;
      const parenthesizedPointer = decl[0]?.text === '(' && decl[1]?.text === '*';
      if (parenthesizedPointer) ++p;
      while (p < decl.length && (isSymbol(decl[p], '&') || isSymbol(decl[p], '*'))) ++p;
      if (p >= decl.length || decl[p].kind !== TokKind.Identifier)
        throw runtimeError('expected variable name in declaration');
      const name = decl[p++].text;
      if (parenthesizedPointer && decl[p]?.text === ')') ++p;
      const { dims, end } = this.arrayDimensions(decl, p);
      if (alias && alias.arrayExtent) dims.push(alias.arrayExtent);
      const tail = sliceTokens(decl, end, decl.length);
      const assigned = tail.length !== 0 && isSymbol(tail[0], '=');
      const initializer = assigned ? sliceTokens(tail, 1, tail.length) : tail;
      if (dims.length !== 0 && assigned) inferArrayDimensions(initializer, dims, 0);
      let value: RuntimeValue = dims.length === 0 ? runtimeDefaultValueForType(type) : createArray(type, dims);
      if (assigned) {
        if (initializer.length > 0 && isIdentifier(initializer[0], 'new')) value = this.evaluate(initializer);
        else if (dims.length !== 0) value = this.initializerValue(initializer, type, dims, 0);
        else
          value = isBraceList(initializer)
            ? this.directInitializer(type, initializer)
            : runtimeCoerceToType(this.evaluateAssignmentExpression(initializer), type);
      } else if (tail.length !== 0) {
        if (!isSymbol(tail[0], '(') && !isBraceList(tail))
          throw runtimeError('unsupported declaration tail near ' + tokensToText(tail));
        if (dims.length !== 0) throw runtimeError('array direct initialization is not supported');
        value = this.directInitializer(type, tail);
      }
      this.m_state.setVariable(
        name,
        runtimeDeepCopy(value),
        userVariables,
        line,
        'declare',
        tokensToExpression(initializer),
      );
      // getFaceForInit returns a C++ reference. Keep the same face instance for
      // reference declarations, while ordinary bowl assignments remain copies.
      if (decl.slice(0, p).some((token) => token.text === '&') && valueTypeOf(value)?.changedInPlace)
        this.m_state.m_values.set(name, value);
    }
  }

  private resolveLValue(tokens: readonly Token[]): LValueRef {
    if (tokens.length === 0 || tokens[0].kind !== TokKind.Identifier) throw runtimeError('left side is not assignable');
    const root = tokens[0].text;
    if (!this.m_state.m_values.has(root)) throw runtimeError('unknown variable: ' + root);
    let slot = mapSlot(this.m_state.m_values, root);
    let path = root;
    let p = 1;
    while (p < tokens.length) {
      if (isSymbol(tokens[p], '[')) {
        const begin = p + 1;
        p = matchingBracketEnd(tokens, begin).end;
        const idx = runtimeInteger(this.evaluate(sliceTokens(tokens, begin, p)));
        const arr = slot.get();
        if (isPoint(arr) || arr instanceof FdVector3d) {
          if (idx < 0n || idx > 2n || p + 1 !== tokens.length) throw runtimeError('invalid point/vector component');

          return { slot, member: 'xyz'[Number(idx)], path: path + `[${idx}]` };
        }
        if (!isArray(arr)) throw runtimeError('indexing requires array lvalue');
        if (idx < 0n || idx >= BigInt(arr.elements.length)) throw runtimeError('array index out of range');
        slot = arraySlot(arr, Number(idx));
        path += `[${idx}]`;
        if (p < tokens.length && isSymbol(tokens[p], ']')) ++p;
        continue;
      }
      if (isSymbol(tokens[p], '.')) {
        ++p;
        if (p >= tokens.length || tokens[p].kind !== TokKind.Identifier)
          throw runtimeError('expected member name after .');
        const member = tokens[p++].text;
        const current = slot.get();
        if (isVectorEnd(current, member)) {
          if (tokens[p]?.text !== '(' || tokens[p + 1]?.text !== ')')
            throw runtimeError(`std::vector::${member} takes no arguments`);
          const index = vectorEndIndex(current, member);
          slot = arraySlot(current, index);
          path += `[${index}]`;
          p += 2;
          continue;
        }
        if (valueTypeOf(current)?.hasFields) {
          slot = memberSlot(current, member);
          path += '.' + member;
          continue;
        }
        if (member !== 'x' && member !== 'y' && member !== 'z')
          throw runtimeError('member is not assignable: ' + member);
        if (p !== tokens.length) throw runtimeError('unexpected tokens after member lvalue');

        return { slot, member, path: path + '.' + member };
      }
      throw runtimeError('invalid lvalue near ' + tokens[p].text);
    }

    return { slot, member: '', path };
  }

  private evaluateAssignmentExpression(tokens: readonly Token[], line = 0): RuntimeValue {
    const assignment = findTopLevelAssignment(tokens);
    if (!assignment) return this.evaluate(tokens);
    const { index, op } = assignment;
    const rhsTokens = sliceTokens(tokens, index + 1, tokens.length);
    const lhs = this.resolveLValue(sliceTokens(tokens, 0, index));
    const rhs =
      op === '=' && isBraceList(rhsTokens)
        ? this.directInitializer(runtimeTypeName(readLValue(lhs)), rhsTokens)
        : this.evaluateAssignmentExpression(rhsTokens, line);
    const before = readLValue(lhs);
    const next = op === '=' ? rhs : compoundOperation(op, before, rhs);
    const sources = this.m_state.captureValueSources(tokensToExpression(tokens));
    writeLValue(lhs, next);
    const after = readLValue(lhs);
    if (line > 0)
      this.m_state.recordVariableChange(line, lhs.path, op, tokensToExpression(rhsTokens), before, after, sources);

    return after;
  }

  private executeIncrement(tokens: readonly Token[], line: number): boolean {
    if (tokens.length < 2) return false;
    const last = tokens[tokens.length - 1].text;
    const prefix = tokens[0].text === '++' || tokens[0].text === '--';
    const postfix = last === '++' || last === '--';
    if (!prefix && !postfix) return false;
    const op = prefix ? tokens[0].text : last;
    const lvt = prefix ? sliceTokens(tokens, 1, tokens.length) : sliceTokens(tokens, 0, tokens.length - 1);
    const ref = this.resolveLValue(lvt);
    const cur = readLValue(ref);
    const next = addValues(cur, op === '++' ? 1n : -1n);
    const sources = this.m_state.captureValueSources(tokensToExpression(lvt));
    writeLValue(ref, next);
    this.m_state.recordVariableChange(line, ref.path, op, '', cur, readLValue(ref), sources);

    return true;
  }

  private executeMutatingMethod(tokens: readonly Token[], line: number): boolean {
    const dot = mutatingMethodDot(tokens);
    if (dot === -1) return false;
    const method = tokens[dot + 1].text;
    if (!isMutatingMethod(method)) return this.executeBowlMethod(tokens, sliceTokens(tokens, 0, dot), line);
    const ref = this.resolveLValue(sliceTokens(tokens, 0, dot));
    if (ref.member !== '') throw runtimeError('method call on scalar member is invalid');
    const before = readLValue(ref);
    const args = parseCallArguments(tokens, dot + 2).map((g) => this.evaluate(g));
    const sources = this.m_state.captureValueSources(tokensToExpression(tokens));
    const next = mutatedValue(method, ref.slot.get(), args);
    if (!next) return false;
    ref.slot.set(next);
    this.m_state.recordVariableChange(
      line,
      ref.path,
      method,
      tokensToExpression(tokens),
      before,
      readLValue(ref),
      sources,
    );

    return true;
  }

  // A bowl method statement such as `info.setCovered(1)` or `infos[i].getFace(0).setCovered(1)`.
  // The receiver can be any lvalue path; the call itself goes through mutateValue so it reaches
  // the stored object rather than a copy.
  private executeBowlMethod(tokens: readonly Token[], receiver: readonly Token[], line: number): boolean {
    if (receiver[0]?.kind !== TokKind.Identifier || !this.m_state.m_values.has(receiver[0].text)) return false;
    let ref: LValueRef;
    try {
      ref = this.resolveLValue(receiver);
    } catch {
      return false;
    }
    const target = ref.member === '' ? ref.slot.get() : undefined;
    if (!valueTypeOf(target)?.changedInPlace) return false;
    const before = runtimeDeepCopy(target);
    this.evaluate(tokens);
    this.m_state.recordVariableChange(line, ref.path, 'method', tokensToExpression(tokens), before, ref.slot.get());

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
    if (intrinsic?.statement?.(this.intrinsics, { name, argGroups, line }, tokens) === 'done') return true;
    this.executeCall(name, argGroups, line, false, baseCall);

    return true;
  }

  // What SDK intrinsics may use from this executor.
  private get intrinsics(): IntrinsicContext {
    this.#intrinsics ??= {
      state: this.m_state,
      evaluate: (tokens) => this.evaluate(tokens),
      resolveLValue: (tokens) => this.resolveLValue(tokens),
      parentApiIndex: () => this.parentApiIndex(),
    };

    return this.#intrinsics;
  }

  private executeCall(
    name: string,
    argGroups: readonly Token[][],
    line: number,
    expression = false,
    baseCall = false,
  ): RuntimeValue {
    if (expression) {
      const intrinsic = languageIntrinsic(name)?.expression?.(this.intrinsics, { name, argGroups, line });
      if (intrinsic) return intrinsic.value;
    }
    line = line || this.m_state.m_apiCalls[this.parentApiIndex()]?.line || 1;
    const args: RuntimeValue[] = [];
    let hasUnresolvedArgument = false;
    argGroups.forEach((group, i) => {
      try {
        args.push(runtimeDeepCopy(this.evaluate(group)));
      } catch (e) {
        this.m_state.addDiagnostic(
          line,
          `cannot evaluate argument ${i + 1} of ${name} (${tokensToExpression(group)}): ${stdException(e).message}`,
        );
        args.push(undefined);
        hasUnresolvedArgument = true;
      }
    });
    const call = createApiCall(name, line, this.parentApiIndex(), [...args], argGroups.map(tokensToExpression));

    const fn = baseCall ? null : this.resolveUserFunction(name, args);
    if (fn) {
      call.userFunctionCall = true;
      populateFormalParameterMetadata(call, fn);
      const functionIndex = this.m_state.recordApiCall(call);
      if (!hasUnresolvedArgument) return this.executeUserFunction(fn, args, argGroups, functionIndex);

      return;
    }
    const intrinsic = sdkIntrinsic(name);
    if (intrinsic?.value) return intrinsic.value(this.intrinsics, { name, argGroups, line }, args);
    if (expression) throw runtimeError('unsupported expression function: ' + name);
    intrinsic?.update?.(this.intrinsics, { name, argGroups, line }, args);
    const signature = resolveApiSignature(call);
    if (!signature && /^(make|add|draw)/.test(name)) {
      this.m_state.addDiagnostic(line, 'unknown native geometry API: ' + name);

      return;
    }
    this.m_state.recordApiCall(call, signature);
  }

  private resolveUserFunction(name: string, args: readonly RuntimeValue[]): Statement | null {
    const candidates = this.m_functions.get(name);
    if (candidates === undefined) return null;
    if (candidates.length === 1) {
      const fn = candidates[0];

      return args.length >= requiredParameterCount(fn) && args.length <= functionParameters(fn).length ? fn : null;
    }
    const matches = candidates.flatMap((fn) => {
      const ranks = functionArgumentRanks(fn, args);

      return ranks ? [{ fn, ranks }] : [];
    });
    const best = matches.filter(
      (match) =>
        !matches.some(
          (other) =>
            other !== match &&
            other.ranks.every((rank, i) => rank <= match.ranks[i]) &&
            other.ranks.some((rank, i) => rank < match.ranks[i]),
        ),
    );
    if (best.length !== 1) throw runtimeError(`${best.length ? 'ambiguous' : 'no matching'} overload: ${name}`);

    return best[0].fn;
  }

  private bindFunctionArguments(
    fn: Statement,
    args: readonly RuntimeValue[],
    traces: readonly RuntimeArgumentTrace[],
  ): void {
    functionParameters(fn).forEach((param, i) => {
      const name = parameterName(param);
      if (name === '') return;
      let value: RuntimeValue = undefined;
      if (i < args.length) value = runtimeDeepCopy(args[i]);
      else if (parameterDefaultPos(param) < param.length) {
        try {
          value = runtimeDeepCopy(this.evaluate(parameterDefaultExpression(param)));
        } catch (e) {
          stdException(e);
          value = undefined;
        }
      }
      const parsed = parseRuntimeType(param, 0);
      if (parsed && value !== undefined && !isArray(value)) value = runtimeCoerceToType(value, parsed.type);
      const trace = i < traces.length ? traces[i] : null;
      const expression = trace ? trace.expression : tokensToExpression(parameterDefaultExpression(param));
      this.m_state.setVariable(name, value, false, fn.startLine, 'bind', expression, trace);
    });
  }

  private executeUserFunction(
    fn: Statement,
    args: readonly RuntimeValue[],
    argumentTokens: readonly Token[][],
    parentApiIndex: number,
  ): RuntimeValue {
    if (this.m_functionCallDepth >= kMaxFunctionCallDepth) throw runtimeError('C++ function call depth exceeded 64');

    const state = this.m_state;
    // Assignment/member targets may already refer to this map while evaluating
    // a call on the RHS. Restore the same storage so the returned value is not lost.
    const savedValues = state.m_values;
    const savedVariableIds = new Map(state.m_variableIds);
    const savedOrder = [...state.m_userVariableOrder];
    const savedLines = new Map(state.m_lastChangedLine);
    const savedFunctionName = state.functionName;
    const savedReturned = this.m_returned;
    const savedReturnValue = this.m_returnValue;
    const savedBreak = this.m_break,
      savedContinue = this.m_continue;
    const savedLoopDepth = this.m_loopDepth,
      savedSwitchDepth = this.m_switchDepth;

    // Callees see globals and their own locals, never the caller's local variables.
    for (const [name, id] of state.globalIds)
      if (savedVariableIds.get(name) === id) state.globalValues.set(name, savedValues.get(name));
    state.m_values = new Map(state.globalValues);
    state.m_variableIds = new Map(state.globalIds);
    state.m_userVariableOrder = savedOrder.filter((name) => state.globalIds.has(name));
    state.functionName = functionScope(fn, this.m_functions.get(fn.functionName)!, this.m_options);
    state.pushScope();
    this.m_returned = false;
    this.m_returnValue = undefined;
    this.m_break = this.m_continue = false;
    this.m_loopDepth = this.m_switchDepth = 0;
    ++this.m_functionCallDepth;
    this.m_parentApiStack.push(parentApiIndex);
    let outputs: ReferenceOutput[];
    let returned: RuntimeValue;
    try {
      this.bindFunctionArguments(fn, args, state.m_apiCalls[parentApiIndex].argumentTraces);
      if (fn.body) this.executeBody(fn.body);
      outputs = this.referenceOutputs(fn, argumentTokens.length);
      const returnType = parseRuntimeType(fn.signature, 0);
      returned = runtimeDeepCopy(
        returnType && this.m_returnValue !== undefined
          ? runtimeCoerceToType(this.m_returnValue, returnType.type)
          : this.m_returnValue,
      );
    } finally {
      this.m_parentApiStack.pop();
      --this.m_functionCallDepth;
      state.popScope();
      for (const [name, id] of state.globalIds) {
        if (savedVariableIds.get(name) === id) {
          savedValues.set(name, state.m_values.get(name));
          for (const [path, line] of state.m_lastChangedLine) if (rootName(path) === name) savedLines.set(path, line);
        }
      }
      state.m_values = savedValues;
      state.m_variableIds = savedVariableIds;
      state.m_userVariableOrder = savedOrder;
      state.m_lastChangedLine = savedLines;
      state.functionName = savedFunctionName;
      this.m_returned = savedReturned;
      this.m_returnValue = savedReturnValue;
      this.m_break = savedBreak;
      this.m_continue = savedContinue;
      this.m_loopDepth = savedLoopDepth;
      this.m_switchDepth = savedSwitchDepth;
    }

    const callLine =
      parentApiIndex >= 0 && parentApiIndex < state.m_apiCalls.length
        ? state.m_apiCalls[parentApiIndex].line
        : fn.startLine;
    for (const output of outputs) this.writeBackReference(fn, callLine, argumentTokens[output.index], output);

    return returned;
  }

  private referenceOutputs(fn: Statement, argumentCount: number): ReferenceOutput[] {
    const outputs: ReferenceOutput[] = [];
    const params = functionParameters(fn);
    for (let i = 0; i < params.length && i < argumentCount; ++i) {
      if (!writableReferenceParameter(params[i])) continue;
      const name = parameterName(params[i]);
      if (name === '' || !this.m_state.hasVariable(name)) continue;
      outputs.push({
        index: i,
        value: this.m_state.lookupValue(name),
        sources: this.m_state.captureValueSources(name),
      });
    }

    return outputs;
  }

  private writeBackReference(fn: Statement, callLine: number, target: readonly Token[], output: ReferenceOutput): void {
    try {
      const dest = this.resolveLValue(target);
      const before = readLValue(dest);
      writeLValue(dest, output.value);
      const after = readLValue(dest);
      if (runtimeValueToCompactString(before) !== runtimeValueToCompactString(after))
        this.m_state.recordVariableChange(
          callLine,
          dest.path,
          'reference write-back',
          fn.functionName,
          before,
          after,
          output.sources,
        );
    } catch (e) {
      this.m_state.addDiagnostic(
        callLine,
        'cannot write back reference parameter of ' + fn.functionName + ': ' + stdException(e).message,
      );
    }
  }

  private initializeFunctionParameters(fn: Statement): void {
    const list = signatureParameterList(fn.signature);
    if (!list) return;
    for (const param of splitTopLevel(list, ',')) {
      if (param.length === 0 || (param.length === 1 && isIdentifier(param[0], 'void'))) continue;
      try {
        this.executeDeclaration(param, fn.startLine, true);
        const name = parameterName(param);
        const configured = this.m_options?.arguments?.get(name);
        if (configured !== undefined) {
          const parsed = parseRuntimeType(param, 0);
          const value = this.evaluate(Lexer.scanExpression(configured));
          this.m_state.setVariable(
            name,
            parsed ? runtimeCoerceToType(value, parsed.type) : value,
            true,
            fn.startLine,
            'input',
            configured,
          );
        }
      } catch (e) {
        if (this.m_options?.arguments?.has(parameterName(param)))
          this.m_state.addDiagnostic(fn.startLine, `${parameterName(param)}: ${stdException(e).message}`);
        else stdException(e);
      }
    }
  }
}

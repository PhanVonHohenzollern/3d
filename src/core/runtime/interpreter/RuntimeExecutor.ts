import { runtimeError, stdException } from '../../../utils/cpp';
import { apiSignatureMetadataForCall } from '../ApiMetadata';
import { FdPoint3d, FdVector3d } from '../FdMath';
import { createApiCall } from '../helpers/apiCalls';
import { braceListItems, createArray, inferArrayDimensions, isBraceList } from '../helpers/arrays';
import {
  functionParameters,
  parameterDefaultExpression,
  parameterDefaultPos,
  parameterName,
  requiredParameterCount,
  populateFormalParameterMetadata,
  signatureParameterList,
  writableReferenceParameter,
} from '../helpers/functionSignatures';
import { lineIntersection } from '../helpers/lineIntersection';
import { arraySlot, mapSlot, readLValue, writeLValue, type LValueRef } from '../helpers/lvalues';
import { parameterDisplayText, parameterTextToValue } from '../helpers/parameters';
import { kMutatingMethods, mutatedValue, mutatingMethodDot } from '../helpers/mutatingMethods';
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
} from '../helpers/tokens';
import { isKnownSdkTypedef, parseRuntimeType } from '../helpers/typeNames';
import { addValues, compoundOperation } from '../helpers/valueOperations';
import type { RuntimeArgumentTrace, RuntimeParameterRequest, RuntimeValueSource } from '../RuntimeTypes';
import {
  isArray,
  isPoint,
  isString,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeDefaultValueForType,
  runtimeInteger,
  runtimeNumber,
  runtimeTruthy,
  runtimeTypeName,
  runtimeValueToCompactString,
  type RuntimeValue,
} from '../RuntimeValue';
import { sdkTypeDefinition } from '../SdkDefinitions';
import { ExprParser } from './ExprParser';
import type { RuntimeState } from './RuntimeState';
import { StatementKind, type Statement } from './Statement';

const kMaxIterations = 10000;
const kMaxFunctionCallDepth = 64;
const kParameterQueries: readonly string[] = [
  'get_fln_size',
  'get_fln_thick',
  'get_fln_diam',
  'get_ldist',
  'get_ext_diam',
];

interface ReferenceOutput {
  index: number;
  value: RuntimeValue;
  sources: RuntimeValueSource[];
}

export class RuntimeExecutor {
  private m_returned = false;
  private m_functionCallDepth = 0;
  private readonly m_functions = new Map<string, Statement[]>();
  private readonly m_parentApiStack: number[] = [];

  constructor(
    private readonly m_state: RuntimeState,
    private readonly m_maxLine: number,
  ) {}

  executeProgram(root: Statement): void {
    for (const child of root.children) {
      if (child.kind !== StatementKind.Function || child.functionName === '') continue;
      const overloads = this.m_functions.get(child.functionName) ?? [];
      overloads.push(child);
      this.m_functions.set(child.functionName, overloads);
    }

    const selectedFunction = this.selectFunction(root);
    if (!selectedFunction) {
      this.executeNode(root, false);
      return;
    }
    ++this.m_functionCallDepth;
    for (const child of root.children) if (child.kind !== StatementKind.Function) this.executeNode(child, false);
    --this.m_functionCallDepth;

    this.initializeFunctionParameters(selectedFunction);
    if (selectedFunction.body) this.executeNode(selectedFunction.body);
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
      this.m_state.addDiagnostic(s.startLine, stdException(e).message);
    }
  }

  private executeNode(s: Statement, skipFunctions = true): void {
    if (this.m_returned) return;
    if (this.m_functionCallDepth === 0 && s.startLine > this.m_maxLine) return;
    switch (s.kind) {
      case StatementKind.Block:
        for (const c of s.children) {
          if (this.m_returned) break;
          if (skipFunctions && c.kind === StatementKind.Function) continue;
          this.executeNode(c, skipFunctions);
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
        this.safeExecute(s, () => this.executeFor(s));
        break;
    }
  }

  private executeFor(s: Statement): void {
    if (s.forInit.length !== 0) this.executeSimple(s.forInit, s.startLine);
    let count = 0;
    while (s.forCondition.length === 0 || runtimeTruthy(this.evaluate(s.forCondition))) {
      if (++count > kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
      if (s.body) this.executeNode(s.body);
      if (this.m_returned) return;
      if (s.forIncrement.length !== 0) this.executeSimple(s.forIncrement, s.startLine);
    }
  }

  private executeSimple(tokens: readonly Token[], line: number): void {
    if (tokens.length === 0) return;
    if (isIdentifier(tokens[0], 'return')) {
      this.m_returned = true;
      return;
    }
    if (isIdentifier(tokens[0], 'delete')) return;
    if (isIdentifier(tokens[0], 'typedef')) {
      if (isKnownSdkTypedef(tokens)) return;
      throw runtimeError('unsupported typedef (only known SDK type definitions are available)');
    }
    if (parseRuntimeType(tokens, 0)) {
      this.executeDeclaration(tokens, line);
      return;
    }
    if (tokens.length >= 2 && tokens[0].kind === TokKind.Identifier && tokens[1].kind === TokKind.Identifier) {
      this.m_state.setVariable(tokens[1].text, undefined, true, line, 'declare', tokensToExpression(tokens));
      return;
    }
    if (this.executeIncrement(tokens, line)) return;
    if (this.executeMutatingMethod(tokens, line)) return;
    if (findTopLevelAssignment(tokens)) {
      this.evaluateAssignmentExpression(tokens, line);
      return;
    }
    if (this.executeFreeCall(tokens, line)) return;
    this.evaluate(tokens);
  }

  private initializerValue(
    tokens: readonly Token[],
    type: string,
    dims: readonly number[],
    level: number,
  ): RuntimeValue {
    if (level >= dims.length) return runtimeCoerceToType(this.evaluate(tokens), type);
    const array = createArray(type, dims, level);
    if (tokens.length === 0) return array;
    if (!isBraceList(tokens)) {
      if (dims[level] > 0) array.elements[0] = this.initializerValue(tokens, type, dims, level + 1);
      return array;
    }
    const parts = braceListItems(tokens);
    for (let i = 0; i < parts.length && i < array.elements.length; ++i) {
      if (parts[i].length === 0) continue;
      array.elements[i] = this.initializerValue(parts[i], type, dims, level + 1);
    }
    return array;
  }

  private directInitializer(type: string, tail: readonly Token[]): RuntimeValue {
    if (tail.length < 2 || !isSymbol(tail[0], '(') || !isSymbol(tail[tail.length - 1], ')'))
      throw runtimeError('invalid direct initializer');
    const inner = sliceTokens(tail, 1, tail.length - 1);
    const args = splitTopLevel(inner, ',');
    if (type === 'FdPoint3d' || type === 'FdVector3d') {
      if (inner.length === 0) return runtimeDefaultValueForType(type);
      if (args.length === 3) {
        const x = runtimeNumber(this.evaluate(args[0]));
        const y = runtimeNumber(this.evaluate(args[1]));
        const z = runtimeNumber(this.evaluate(args[2]));
        return type === 'FdPoint3d' ? new FdPoint3d(x, y, z) : new FdVector3d(x, y, z);
      }
    }
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
      while (p < decl.length && (isSymbol(decl[p], '&') || isSymbol(decl[p], '*'))) ++p;
      if (p >= decl.length || decl[p].kind !== TokKind.Identifier)
        throw runtimeError('expected variable name in declaration');
      const name = decl[p++].text;
      const { dims, end } = this.arrayDimensions(decl, p);
      if (alias && alias.arrayExtent) dims.push(alias.arrayExtent);
      const tail = sliceTokens(decl, end, decl.length);
      const assigned = tail.length !== 0 && isSymbol(tail[0], '=');
      const initializer = assigned ? sliceTokens(tail, 1, tail.length) : tail;
      if (dims.length !== 0 && assigned) inferArrayDimensions(initializer, dims, 0);
      let value: RuntimeValue = dims.length === 0 ? runtimeDefaultValueForType(type) : createArray(type, dims);
      if (assigned) {
        if (dims.length !== 0) value = this.initializerValue(initializer, type, dims, 0);
        else value = runtimeCoerceToType(this.evaluateAssignmentExpression(initializer), type);
      } else if (tail.length !== 0) {
        if (!isSymbol(tail[0], '(')) throw runtimeError('unsupported declaration tail near ' + tokensToText(tail));
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
    const rhs = this.evaluateAssignmentExpression(rhsTokens, line);
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
    if (!kMutatingMethods.includes(method)) return false;
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

  private executeFreeCall(tokens: readonly Token[], line: number): boolean {
    if (tokens.length < 2 || tokens[0].kind !== TokKind.Identifier || !isSymbol(tokens[1], '(')) return false;
    const name = tokens[0].text;
    const argGroups = parseCallArguments(tokens, 1);

    if (name === 'get_val') this.executeGetVal(argGroups, line);
    else if (kParameterQueries.includes(name)) this.executeParameterQuery(name, argGroups, line);
    else if (name === 'lineSegToLineSegInt' || name === 'lineToLineInt')
      this.executeLineIntersection(name, tokens, argGroups, line);
    else {
      if (name === 'setPrimitiveMode' && argGroups.length === 1) {
        const mode = this.evaluate(argGroups[0]);
        this.m_state.setVariable('m_primitiveMode', runtimeCoerceToType(mode, 'int'), false);
      }
      if (name !== 'ASSERT' && name !== 'delete') this.executeCall(name, argGroups, line);
    }
    return true;
  }

  private executeGetVal(argGroups: readonly Token[][], line: number): void {
    if (argGroups.length !== 2) throw runtimeError('get_val requires parameter name and destination');
    const name = this.evaluate(argGroups[0]);
    if (!isString(name)) throw runtimeError('get_val parameter name must be a string');
    const dest = this.resolveLValue(argGroups[1]);
    const before = readLValue(dest);

    const configured = this.m_state.m_parameters.get(name);
    if (configured !== undefined) {
      writeLValue(dest, parameterTextToValue(configured, before));
      const after = readLValue(dest);
      if (runtimeValueToCompactString(before) !== runtimeValueToCompactString(after))
        this.m_state.recordVariableChange(line, dest.path, 'get_val', name, before, after);
    }

    this.m_state.recordParameterRequest({
      name,
      type: runtimeTypeName(before),
      defaultValue: parameterDisplayText(before),
      currentValue: parameterDisplayText(readLValue(dest)),
      sourceFunction: 'get_val',
      variableName: dest.path,
      line,
    });
  }

  private executeParameterQuery(name: string, argGroups: readonly Token[][], line: number): void {
    if (argGroups.length < 2) return;
    const id = this.evaluate(argGroups[0]);
    const dest = this.resolveLValue(argGroups[1]);
    const current = readLValue(dest);
    const key = (isString(id) ? id : '') + ':' + name;
    const request: RuntimeParameterRequest = {
      name: key,
      type: runtimeTypeName(current),
      defaultValue: runtimeValueToCompactString(current),
      currentValue: runtimeValueToCompactString(current),
      sourceFunction: name,
      variableName: dest.path,
      line,
    };
    this.m_state.recordParameterRequest(request);
    const configured = this.m_state.m_parameters.get(key);
    if (configured !== undefined) writeLValue(dest, parameterTextToValue(configured, current));
  }

  private executeLineIntersection(
    name: string,
    tokens: readonly Token[],
    argGroups: readonly Token[][],
    line: number,
  ): void {
    if (argGroups.length !== 5) throw runtimeError(name + ' requires 5 arguments');
    const [a0, a1, b0, b1] = argGroups.slice(0, 4).map((group) => this.evaluate(group));
    if (!isPoint(a0) || !isPoint(a1) || !isPoint(b0) || !isPoint(b1))
      throw runtimeError(name + ' requires four FdPoint3d inputs');
    const outRef = this.resolveLValue(argGroups[4]);
    const before = readLValue(outRef);
    if (!isPoint(before)) throw runtimeError(name + ' output must be FdPoint3d');
    const intersection = lineIntersection(a0, a1, b0, b1, name === 'lineSegToLineSegInt');
    if (intersection) {
      const sources = this.m_state.captureValueSources(tokensToExpression(tokens));
      writeLValue(outRef, intersection);
      this.m_state.recordVariableChange(
        line,
        outRef.path,
        name,
        tokensToExpression(tokens),
        before,
        readLValue(outRef),
        sources,
      );
    }
    const args = [a0, a1, b0, b1, readLValue(outRef)].map(runtimeDeepCopy);
    this.m_state.recordApiCall(
      createApiCall(name, line, this.parentApiIndex(), args, argGroups.map(tokensToExpression)),
    );
  }

  private executeCall(name: string, argGroups: readonly Token[][], line: number): void {
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

    const fn = this.resolveUserFunction(name, args.length);
    if (fn) {
      call.userFunctionCall = true;
      populateFormalParameterMetadata(call, fn);
      const functionIndex = this.m_state.recordApiCall(call);
      if (!hasUnresolvedArgument) this.executeUserFunction(fn, args, argGroups, functionIndex);
      return;
    }
    if (!apiSignatureMetadataForCall(call) && /^(make|add|draw)/.test(name)) {
      this.m_state.addDiagnostic(line, 'unknown native geometry API: ' + name);
      return;
    }
    this.m_state.recordApiCall(call);
  }

  private resolveUserFunction(name: string, argumentCount: number): Statement | null {
    const candidates = this.m_functions.get(name);
    if (candidates === undefined) return null;
    let fallback: Statement | null = null;
    for (const fn of candidates) {
      const total = functionParameters(fn).length;
      if (argumentCount < requiredParameterCount(fn) || argumentCount > total) continue;
      if (argumentCount === total) return fn;
      if (!fallback) fallback = fn;
    }
    return fallback;
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
  ): void {
    if (this.m_functionCallDepth >= kMaxFunctionCallDepth) throw runtimeError('C++ function call depth exceeded 64');

    const state = this.m_state;
    const savedValues = new Map(state.m_values);
    const savedVariableIds = new Map(state.m_variableIds);
    const savedOrder = [...state.m_userVariableOrder];
    const savedReturned = this.m_returned;

    this.bindFunctionArguments(fn, args, state.m_apiCalls[parentApiIndex].argumentTraces);
    this.m_returned = false;
    ++this.m_functionCallDepth;
    this.m_parentApiStack.push(parentApiIndex);
    if (fn.body) this.executeNode(fn.body);
    this.m_parentApiStack.pop();
    --this.m_functionCallDepth;

    const outputs = this.referenceOutputs(fn, argumentTokens.length);

    state.m_values = savedValues;
    state.m_variableIds = savedVariableIds;
    state.m_userVariableOrder = savedOrder;
    this.m_returned = savedReturned;

    const callLine =
      parentApiIndex >= 0 && parentApiIndex < state.m_apiCalls.length
        ? state.m_apiCalls[parentApiIndex].line
        : fn.startLine;
    for (const output of outputs) this.writeBackReference(fn, callLine, argumentTokens[output.index], output);
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
      } catch (e) {
        stdException(e);
      }
    }
  }
}

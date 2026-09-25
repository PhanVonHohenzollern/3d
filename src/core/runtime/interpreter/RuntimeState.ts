import { runtimeError, stdException } from '../../../utils/cpp';
import { braceListItems, isBraceList } from '../helpers/arrays';
import type { RuntimeFunctionMacro } from '../helpers/macros';
import { matchingBracketEnd, isSymbol, sliceTokens, TokKind, tokensToExpression, type Token } from '../helpers/tokens';
import { parentPaths, rootName } from '../helpers/variablePaths';
import type {
  RuntimeApiCall,
  RuntimeArgumentTrace,
  RuntimeDiagnostic,
  RuntimeParameterRequest,
  RuntimeValueSource,
  RuntimeVariableChange,
} from '../RuntimeTypes';
import { isArray, isPoint, isVector, runtimeDeepCopy, runtimeInteger, type RuntimeValue } from '../RuntimeValue';
import { ExprParser } from './ExprParser';
import { Lexer } from './Lexer';

const emptyTrace = (): RuntimeArgumentTrace => ({ expression: '', sources: [], elements: [] });

const isPureIndexToken = (t: Token): boolean =>
  t.kind === TokKind.Number ||
  t.kind === TokKind.Identifier ||
  (t.kind === TokKind.Symbol &&
    (t.text === '+' || t.text === '-' || t.text === '*' || t.text === '/' || t.text === '%'));

export class RuntimeState {
  functionName = '';
  globalValues = new Map<string, RuntimeValue>();
  globalIds = new Map<string, number>();
  private scopes: Map<string, { exists: boolean; value: RuntimeValue; id?: number; lines: Map<string, number> }>[] = [];

  pushScope(): void {
    this.scopes.push(new Map());
  }

  popScope(): void {
    const scope = this.scopes.pop();
    if (!scope) return;
    for (const [name, saved] of scope) {
      if (saved.exists)
        this.m_values.set(
          name,
          saved.id !== undefined && this.globalIds.get(name) === saved.id ? this.globalValues.get(name) : saved.value,
        );
      else {
        this.m_values.delete(name);
        this.m_userVariableOrder = this.m_userVariableOrder.filter((item) => item !== name);
      }
      if (saved.id === undefined) this.m_variableIds.delete(name);
      else this.m_variableIds.set(name, saved.id);
      for (const path of this.m_lastChangedLine.keys())
        if (rootName(path) === name) this.m_lastChangedLine.delete(path);
      for (const [path, line] of saved.lines) this.m_lastChangedLine.set(path, line);
      if (saved.id !== undefined && this.globalIds.get(name) === saved.id)
        for (const change of this.m_variableChanges)
          if (change.variableId === saved.id) this.m_lastChangedLine.set(change.name, change.line);
    }
  }

  callFunction?: (name: string, args: readonly Token[][], line: number) => RuntimeValue;
  mutateValue?: (target: readonly Token[], method: string, args: readonly RuntimeValue[], line: number) => RuntimeValue;
  m_values = new Map<string, RuntimeValue>();
  m_variableIds = new Map<string, number>();
  m_nextVariableId = 0;
  m_userVariableOrder: string[] = [];
  m_diagnostics: RuntimeDiagnostic[] = [];
  m_variableChanges: RuntimeVariableChange[] = [];
  m_lastChangedLine = new Map<string, number>();
  m_apiCalls: RuntimeApiCall[] = [];
  m_parameterRequests: RuntimeParameterRequest[] = [];
  m_parameters = new Map<string, string>();
  m_functionMacros = new Map<string, RuntimeFunctionMacro>();

  reset(): void {
    this.functionName = '';
    this.globalValues = new Map();
    this.globalIds = new Map();
    this.scopes = [];
    this.callFunction = undefined;
    this.mutateValue = undefined;
    this.m_values = new Map();
    this.m_variableIds = new Map();
    this.m_nextVariableId = 0;
    this.m_userVariableOrder = [];
    this.m_diagnostics = [];
    this.m_variableChanges = [];
    this.m_lastChangedLine = new Map();
    this.m_apiCalls = [];
    this.m_parameterRequests = [];
    this.m_functionMacros = new Map();
  }

  lookupValue(name: string): RuntimeValue {
    if (!this.m_values.has(name)) throw runtimeError('unknown variable: ' + name);

    return runtimeDeepCopy(this.m_values.get(name));
  }

  hasVariable(name: string): boolean {
    return this.m_values.has(name);
  }

  captureValueSources(expression: string): RuntimeValueSource[] {
    const sources: RuntimeValueSource[] = [];
    const tokens = new Lexer(expression).scan();
    for (let i = 0; i < tokens.length; ++i) {
      if (tokens[i].kind !== TokKind.Identifier) continue;
      if (i > 0 && (isSymbol(tokens[i - 1], '.') || isSymbol(tokens[i - 1], '::'))) continue;
      let root = tokens[i].text;
      let p = i + 1;
      while (p + 1 < tokens.length && isSymbol(tokens[p], '::') && tokens[p + 1].kind === TokKind.Identifier) {
        root += '::' + tokens[p + 1].text;
        p += 2;
      }
      if (!this.m_values.has(root)) continue;
      const { path, value } = this.followSourcePath(tokens, p, root, this.m_values.get(root));
      if (sources.some((s) => s.name === path)) continue;
      sources.push({
        name: path,
        value: runtimeDeepCopy(value),
        variableId: this.m_variableIds.get(root) ?? -1,
        historyEnd: this.m_variableChanges.length,
      });
    }

    return sources;
  }

  private followSourcePath(
    tokens: readonly Token[],
    start: number,
    root: string,
    rootValue: RuntimeValue,
  ): { path: string; value: RuntimeValue } {
    let path = root;
    let value = rootValue;
    let p = start;
    while (p < tokens.length) {
      if (isSymbol(tokens[p], '[')) {
        const begin = p + 1;
        const bracket = matchingBracketEnd(tokens, begin);
        p = bracket.end;
        if (!bracket.closed) break;
        const indexTokens = sliceTokens(tokens, begin, p);
        if (!indexTokens.every(isPureIndexToken)) break;
        try {
          const index = runtimeInteger(new ExprParser(indexTokens, this).parse());
          if (isArray(value)) {
            if (index < 0n || index >= BigInt(value.elements.length)) break;
            value = value.elements[Number(index)];
            path += `[${index}]`;
          } else if (index >= 0n && index < 3n && (isPoint(value) || isVector(value))) {
            const component = 'xyz'[Number(index)];
            value = index === 0n ? value.x : index === 1n ? value.y : value.z;
            path += '.' + component;
          } else break;
        } catch (e) {
          stdException(e);
          break;
        }
        ++p;
      } else if (
        isSymbol(tokens[p], '.') &&
        p + 1 < tokens.length &&
        (tokens[p + 1].text === 'x' || tokens[p + 1].text === 'y' || tokens[p + 1].text === 'z')
      ) {
        const member = tokens[p + 1].text;
        if (isPoint(value) || isVector(value)) value = member === 'x' ? value.x : member === 'y' ? value.y : value.z;
        else break;
        path += '.' + member;
        p += 2;
      } else break;
    }

    return { path, value };
  }

  captureArgumentTrace(expression: string, value: RuntimeValue, depth = 0): RuntimeArgumentTrace {
    const trace: RuntimeArgumentTrace = { expression, sources: this.captureValueSources(expression), elements: [] };
    if (!isArray(value) || depth >= 4) return trace;
    const tokens = Lexer.scanExpression(expression);
    const initializer = isBraceList(tokens);
    const parts = initializer ? braceListItems(tokens) : [];
    for (let i = 0; i < value.elements.length; ++i) {
      let elementExpression = '';
      if (initializer) elementExpression = i < parts.length ? tokensToExpression(parts[i]) : '';
      else if (expression !== '') elementExpression = `${expression}[${i}]`;
      trace.elements.push(this.captureArgumentTrace(elementExpression, value.elements[i], depth + 1));
    }

    return trace;
  }

  setVariable(
    name: string,
    value: RuntimeValue,
    userVariable = true,
    line = 0,
    operation = '',
    expression = '',
    inputTrace: RuntimeArgumentTrace | null = null,
  ): void {
    const existed = this.m_values.has(name);
    const scope = this.scopes.at(-1);
    if (scope && (operation === 'declare' || operation === 'bind') && !scope.has(name))
      scope.set(name, {
        exists: existed,
        value: this.m_values.get(name),
        id: this.m_variableIds.get(name),
        lines: new Map([...this.m_lastChangedLine].filter(([path]) => rootName(path) === name)),
      });
    const newLifetime = !existed || operation === 'declare' || operation === 'bind';
    const before: RuntimeValue = existed && !newLifetime ? runtimeDeepCopy(this.m_values.get(name)) : undefined;
    let trace = inputTrace ?? emptyTrace();
    if (!inputTrace && line > 0) trace = this.captureArgumentTrace(expression, value);
    if (newLifetime) this.m_variableIds.set(name, this.m_nextVariableId++);
    if (userVariable && !existed) this.m_userVariableOrder.push(name);
    const stored = runtimeDeepCopy(value);
    this.m_values.set(name, stored);
    if (this.globalIds.has(name) && this.globalIds.get(name) === this.m_variableIds.get(name))
      this.globalValues.set(name, stored);
    if (line <= 0) return;
    this.recordVariableChange(
      line,
      name,
      operation === '' ? 'set' : operation,
      expression,
      before,
      stored,
      trace.sources,
    );
    if (newLifetime) this.recordElementDeclarations(line, name, stored, trace);
  }

  private recordElementDeclarations(
    line: number,
    base: string,
    value: RuntimeValue,
    input: RuntimeArgumentTrace,
  ): void {
    if (!isArray(value)) return;
    value.elements.forEach((element, i) => {
      const child = `${base}[${i}]`;
      const elementTrace = i < input.elements.length ? input.elements[i] : emptyTrace();
      this.recordVariableChange(
        line,
        child,
        'declare',
        elementTrace.expression,
        undefined,
        element,
        elementTrace.sources,
      );
      this.recordElementDeclarations(line, child, element, elementTrace);
    });
  }

  addDiagnostic(line: number, message: string): void {
    const exists = this.m_diagnostics.some((d) => d.line === line && d.message === message);
    if (!exists) this.m_diagnostics.push({ line, message });
  }

  recordApiCall(call: RuntimeApiCall): number {
    call.arguments = call.arguments.map(runtimeDeepCopy);
    call.arguments.forEach((argument, i) =>
      call.argumentTraces.push(this.captureArgumentTrace(call.argumentExpressions[i] ?? '', argument)),
    );
    this.m_apiCalls.push(call);

    return this.m_apiCalls.length - 1;
  }

  recordVariableChange(
    line: number,
    name: string,
    operation: string,
    expression: string,
    before: RuntimeValue,
    after: RuntimeValue,
    sources: RuntimeValueSource[] = [],
  ): void {
    if (line <= 0 || name === '') return;
    const root = rootName(name);
    if (this.globalIds.has(root) && this.globalIds.get(root) === this.m_variableIds.get(root))
      this.globalValues.set(root, this.m_values.get(root));
    this.m_variableChanges.push({
      line,
      name,
      operation,
      expression,
      before: runtimeDeepCopy(before),
      after: runtimeDeepCopy(after),
      variableId: this.m_variableIds.get(rootName(name)) ?? -1,
      sources,
    });
    this.m_lastChangedLine.set(name, line);
    for (const parent of parentPaths(name)) this.m_lastChangedLine.set(parent, line);
  }

  recordParameterRequest(request: RuntimeParameterRequest): void {
    const index = this.m_parameterRequests.findIndex(
      (r) =>
        r.name === request.name &&
        r.functionName === request.functionName &&
        r.sourceFunction === request.sourceFunction &&
        r.variableName === request.variableName,
    );
    if (index === -1) this.m_parameterRequests.push(request);
    else this.m_parameterRequests[index] = request;
  }
}

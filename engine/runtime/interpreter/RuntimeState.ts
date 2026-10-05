import { resolveApiSignature, type ApiSignatureMetadata } from '@engine/runtime/ApiMetadata';
import { runtimeError } from '@engine/runtime/cpp/cpp';
import type { RuntimeFunctionMacro } from '@engine/runtime/helpers/macros';
import { parentPaths, rootName } from '@engine/runtime/helpers/variablePaths';
import type {
  RuntimeApiCall,
  RuntimeArgumentTrace,
  RuntimeDiagnostic,
  RuntimeParameterRequest,
  RuntimeResult,
  RuntimeValueSource,
  RuntimeVariableChange,
} from '@engine/runtime/RuntimeTypes';
import { isArray, runtimeDeepCopy, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import { captureArgumentTrace, captureValueSources, type SourceView } from '@engine/runtime/interpreter/sourceTracing';
import type { EvalContext } from '@engine/runtime/interpreter/evalContext';
import { mapSlot, type RuntimeValueSlot } from '@engine/runtime/helpers/lvalues';
import { collectVariables } from '@engine/runtime/helpers/runtimeResult';

const emptyTrace = (): RuntimeArgumentTrace => ({ expression: '', sources: [], elements: [] });

// What a function call saves of its caller's variables; see pushFrame.
export interface CallFrame {
  readonly values: Map<string, RuntimeValue>;
  readonly variableIds: Map<string, number>;
  readonly order: string[];
  readonly lines: Map<string, number>;
  readonly functionName: string;
}

// A saved variable binding, for code that shadows one name for a while (range-for variables).
export interface SavedBinding {
  readonly existed: boolean;
  readonly value: RuntimeValue;
}

// Everything a program run changes: variables and their history, scopes, recorded API calls,
// parameter requests and diagnostics. Only this class touches the storage; callers use its methods.
export class RuntimeState implements EvalContext {
  debugApiIndex: number | undefined;
  #functionName = '';
  #globalValues = new Map<string, RuntimeValue>();
  #globalIds = new Map<string, number>();
  #scopes: Map<string, { exists: boolean; value: RuntimeValue; id?: number; lines: Map<string, number> }>[] = [];
  #values = new Map<string, RuntimeValue>();
  #variableIds = new Map<string, number>();
  #nextVariableId = 0;
  #pointerIds = new Map<number, string>();
  #userVariableOrder: string[] = [];
  #diagnostics: RuntimeDiagnostic[] = [];
  #variableChanges: RuntimeVariableChange[] = [];
  #lastChangedLine = new Map<string, number>();
  #apiCalls: RuntimeApiCall[] = [];
  #parameterRequests: RuntimeParameterRequest[] = [];
  #parameters = new Map<string, string>();
  #functionMacros = new Map<string, RuntimeFunctionMacro>();

  // The scope parameter values are looked up in ('' outside functions).
  get functionName(): string {
    return this.#functionName;
  }

  pushScope(): void {
    this.#scopes.push(new Map());
  }

  popScope(): void {
    const scope = this.#scopes.pop();
    if (!scope) return;
    for (const [name, saved] of scope) {
      if (saved.exists)
        this.#values.set(
          name,
          saved.id !== undefined && this.#globalIds.get(name) === saved.id ? this.#globalValues.get(name) : saved.value,
        );
      else {
        this.#values.delete(name);
        this.#userVariableOrder = this.#userVariableOrder.filter((item) => item !== name);
      }
      if (saved.id === undefined) this.#variableIds.delete(name);
      else this.#variableIds.set(name, saved.id);
      for (const path of this.#lastChangedLine.keys()) if (rootName(path) === name) this.#lastChangedLine.delete(path);
      for (const [path, line] of saved.lines) this.#lastChangedLine.set(path, line);
      if (saved.id !== undefined && this.#globalIds.get(name) === saved.id)
        for (const change of this.#variableChanges)
          if (change.variableId === saved.id) this.#lastChangedLine.set(change.name, change.line);
    }
  }

  // Starts a new run; the configured parameters stay.
  reset(): void {
    this.debugApiIndex = undefined;
    this.#functionName = '';
    this.#globalValues = new Map();
    this.#globalIds = new Map();
    this.#scopes = [];
    this.#values = new Map();
    this.#variableIds = new Map();
    this.#nextVariableId = 0;
    this.#pointerIds.clear();
    this.#userVariableOrder = [];
    this.#diagnostics = [];
    this.#variableChanges = [];
    this.#lastChangedLine = new Map();
    this.#apiCalls = [];
    this.#parameterRequests = [];
    this.#functionMacros = new Map();
  }

  setParameters(parameters: ReadonlyMap<string, string>): void {
    this.#parameters = new Map(parameters);
  }

  // The Parameters panel's text for a parameter key, if the user set one.
  parameter(key: string): string | undefined {
    return this.#parameters.get(key);
  }

  functionMacro(name: string): RuntimeFunctionMacro | undefined {
    return this.#functionMacros.get(name);
  }

  defineFunctionMacro(name: string, macro: RuntimeFunctionMacro): void {
    this.#functionMacros.set(name, macro);
  }

  withBindings<T>(bindings: ReadonlyMap<string, RuntimeValue>, evaluate: () => T): T {
    const values = this.#values;
    const saved = [...bindings].map(([name, value]) => {
      const existed = values.has(name);
      const previous = existed ? runtimeDeepCopy(values.get(name)) : undefined;
      values.set(name, runtimeDeepCopy(value));

      return { name, existed, previous };
    });
    try {
      return evaluate();
    } finally {
      for (const { name, existed, previous } of saved) {
        if (existed) values.set(name, previous);
        else values.delete(name);
      }
    }
  }

  // The storage cell of a variable, for assignments through paths such as a[i].x.
  valueSlot(name: string): RuntimeValueSlot {
    return mapSlot(this.#values, name);
  }

  // Stores a value without history or copying: SDK constants, and references that must share
  // their object (FdBowlFace& face = info.getFaceForInit(0)).
  bindValue(name: string, value: RuntimeValue): void {
    this.#values.set(name, value);
  }

  bindPointer(name: string, value: RuntimeValue, type = this.pointerType(name) ?? ''): void {
    const id = this.#variableIds.get(name);
    if (id !== undefined) this.#pointerIds.set(id, type);
    this.bindValue(name, value);
  }

  isPointer(name: string): boolean {
    const id = this.#variableIds.get(name);

    return id !== undefined && this.#pointerIds.has(id);
  }

  pointerType(name: string): string | undefined {
    const id = this.#variableIds.get(name);

    return id === undefined ? undefined : this.#pointerIds.get(id);
  }

  saveBinding(name: string): SavedBinding {
    return { existed: this.#values.has(name), value: this.#values.get(name) };
  }

  restoreBinding(name: string, saved: SavedBinding): void {
    if (saved.existed) this.#values.set(name, saved.value);
    else this.#values.delete(name);
  }

  // The values global statements have produced so far; function calls start from these.
  snapshotGlobals(): void {
    this.#globalValues = new Map(this.#values);
    this.#globalIds = new Map(this.#variableIds);
  }

  // Runs the entry function's body in place, in that function's parameter scope.
  enterFunctionScope(functionName: string): void {
    this.#functionName = functionName;
  }

  // A call to a program function: the callee sees globals and its own locals, never the caller's
  // locals. popFrame restores the caller, keeping global changes the callee made.
  pushFrame(functionName: string): CallFrame {
    // Assignment/member targets may already refer to the caller's map while evaluating a call on
    // the right-hand side, so popFrame restores the same map object.
    const frame: CallFrame = {
      values: this.#values,
      variableIds: new Map(this.#variableIds),
      order: [...this.#userVariableOrder],
      lines: new Map(this.#lastChangedLine),
      functionName: this.#functionName,
    };
    for (const [name, id] of this.#globalIds)
      if (frame.variableIds.get(name) === id) this.#globalValues.set(name, frame.values.get(name));
    this.#values = new Map(this.#globalValues);
    this.#variableIds = new Map(this.#globalIds);
    this.#userVariableOrder = frame.order.filter((name) => this.#globalIds.has(name));
    this.#functionName = functionName;
    this.pushScope();

    return frame;
  }

  popFrame(frame: CallFrame): void {
    this.popScope();
    for (const [name, id] of this.#globalIds) {
      if (frame.variableIds.get(name) === id) {
        frame.values.set(name, this.#values.get(name));
        for (const [path, line] of this.#lastChangedLine) if (rootName(path) === name) frame.lines.set(path, line);
      }
    }
    this.#values = frame.values;
    this.#variableIds = frame.variableIds;
    this.#userVariableOrder = frame.order;
    this.#lastChangedLine = frame.lines;
    this.#functionName = frame.functionName;
  }

  apiCall(index: number): RuntimeApiCall | undefined {
    return this.#apiCalls[index];
  }

  result(): RuntimeResult {
    return {
      ...(this.debugApiIndex === undefined ? {} : { debugApiIndex: this.debugApiIndex }),
      variables: collectVariables(this.#userVariableOrder, this.#values, this.#lastChangedLine),
      variableChanges: this.#variableChanges.slice(),
      diagnostics: this.#diagnostics.slice(),
      apiCalls: this.#apiCalls.slice(),
      parameterRequests: this.#parameterRequests.slice(),
    };
  }

  // A copy of the variables for evaluating expressions after the run (the Link panel's fields).
  // Parameter names also resolve, to the value their variable had.
  evaluationSnapshot(): RuntimeState {
    const snapshot = new RuntimeState();
    for (const [name, value] of this.#values) snapshot.#values.set(name, runtimeDeepCopy(value));
    snapshot.#functionMacros = new Map(this.#functionMacros);
    for (const request of this.#parameterRequests) {
      if (this.#values.has(request.variableName) && !snapshot.#values.has(request.name))
        snapshot.#values.set(request.name, runtimeDeepCopy(this.#values.get(request.variableName)));
    }

    return snapshot;
  }

  lookupValue(name: string, copy = true): RuntimeValue {
    if (!this.#values.has(name)) throw runtimeError('unknown variable: ' + name);

    const value = this.#values.get(name);

    return copy ? runtimeDeepCopy(value) : value;
  }

  hasVariable(name: string): boolean {
    return this.#values.has(name);
  }

  captureValueSources(expression: string): RuntimeValueSource[] {
    return captureValueSources(expression, this.#sourceView());
  }

  captureArgumentTrace(expression: string, value: RuntimeValue): RuntimeArgumentTrace {
    return captureArgumentTrace(expression, value, this.#sourceView());
  }

  #sourceView(): SourceView {
    return {
      context: this,
      value: (name) => this.#values.get(name),
      has: (name) => this.#values.has(name),
      variableId: (name) => this.#variableIds.get(name) ?? -1,
      historyLength: this.#variableChanges.length,
    };
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
    const existed = this.#values.has(name);
    const scope = this.#scopes.at(-1);
    if (scope && (operation === 'declare' || operation === 'bind') && !scope.has(name))
      scope.set(name, {
        exists: existed,
        value: this.#values.get(name),
        id: this.#variableIds.get(name),
        lines: new Map([...this.#lastChangedLine].filter(([path]) => rootName(path) === name)),
      });
    const newLifetime = !existed || operation === 'declare' || operation === 'bind';
    const before: RuntimeValue = existed && !newLifetime ? runtimeDeepCopy(this.#values.get(name)) : undefined;
    let trace = inputTrace ?? emptyTrace();
    if (!inputTrace && line > 0) trace = this.captureArgumentTrace(expression, value);
    if (newLifetime) this.#variableIds.set(name, this.#nextVariableId++);
    if (userVariable && !existed) this.#userVariableOrder.push(name);
    const stored = runtimeDeepCopy(value);
    this.#values.set(name, stored);
    if (this.#globalIds.has(name) && this.#globalIds.get(name) === this.#variableIds.get(name))
      this.#globalValues.set(name, stored);
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
    const exists = this.#diagnostics.some((d) => d.line === line && d.message === message);
    if (!exists) this.#diagnostics.push({ line, message });
  }

  // `signature` may be passed when the caller already resolved it for these arguments.
  recordApiCall(call: RuntimeApiCall, signature?: ApiSignatureMetadata | null): number {
    call.arguments = call.arguments.map(runtimeDeepCopy);
    call.signature = signature === undefined ? resolveApiSignature(call) : signature;
    call.arguments.forEach((argument, i) =>
      call.argumentTraces.push(this.captureArgumentTrace(call.argumentExpressions[i] ?? '', argument)),
    );
    this.#apiCalls.push(call);

    return this.#apiCalls.length - 1;
  }

  recordVariableChange(
    line: number,
    name: string,
    operation: string,
    expression: string,
    before: RuntimeValue,
    after: RuntimeValue,
    sources: RuntimeValueSource[] = [],
    includeAliases = true,
  ): void {
    if (line <= 0 || name === '') return;
    const root = rootName(name);
    if (this.#globalIds.has(root) && this.#globalIds.get(root) === this.#variableIds.get(root))
      this.#globalValues.set(root, this.#values.get(root));
    this.#variableChanges.push({
      line,
      name,
      operation,
      expression,
      before: runtimeDeepCopy(before),
      after: runtimeDeepCopy(after),
      variableId: this.#variableIds.get(rootName(name)) ?? -1,
      sources,
    });
    this.#lastChangedLine.set(name, line);
    for (const parent of parentPaths(name)) this.#lastChangedLine.set(parent, line);
    const value = this.#values.get(root);
    if (includeAliases && isArray(value) && operation !== 'declare' && operation !== 'rebind')
      for (const [alias, target] of this.#values)
        if (alias !== root && target === value)
          this.recordVariableChange(
            line,
            alias + name.slice(root.length),
            operation,
            expression,
            before,
            after,
            sources,
            false,
          );
  }

  recordParameterRequest(request: RuntimeParameterRequest): void {
    const index = this.#parameterRequests.findIndex(
      (r) =>
        r.name === request.name &&
        r.functionName === request.functionName &&
        r.sourceFunction === request.sourceFunction &&
        r.variableName === request.variableName,
    );
    if (index === -1) this.#parameterRequests.push(request);
    else this.#parameterRequests[index] = request;
  }
}

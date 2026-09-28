import { doubleToInt64, runtimeError, stdException, trim } from '@engine/runtime/cpp/cpp';
import { FdVector3d } from '@engine/runtime/FdMath';
import { parseMacroDefinition } from '@engine/runtime/helpers/macros';
import { scanGetValParameters } from '@engine/runtime/analysis/parameterScan';
import { preprocess } from '@engine/runtime/interpreter/preprocessor';
import { collectVariables } from '@engine/runtime/helpers/runtimeResult';
import { ExprParser } from '@engine/runtime/interpreter/ExprParser';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import { ProgramParser } from '@engine/runtime/interpreter/ProgramParser';
import { RuntimeExecutor } from '@engine/runtime/interpreter/RuntimeExecutor';
import { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import type { RuntimeExecutionOptions, RuntimeParameterRequest, RuntimeResult } from '@engine/runtime/RuntimeTypes';
import { runtimeDeepCopy, runtimeNumber } from '@engine/runtime/RuntimeValue';
import { kSdkConstants } from '@engine/runtime/SdkDefinitions';

export type * from '@engine/runtime/RuntimeTypes';
export type { RuntimeFunctionMacro } from '@engine/runtime/helpers/macros';
export { runtimeSourceHistory } from '@engine/runtime/helpers/runtimeResult';

export class GeometryRuntime {
  private readonly m_state = new RuntimeState();

  executeUpToLine(
    code: string,
    maxLine: number,
    fullProgram = false,
    options?: RuntimeExecutionOptions,
  ): RuntimeResult {
    const state = this.m_state;
    state.reset();
    this.seedBuiltinValues();

    try {
      const processed = preprocess(code);
      this.importSourceMacros(processed.definitions.join('\n'));
      const program = new ProgramParser(new Lexer(processed.code).scan()).parse();
      const effectiveMaxLine = Math.min(Math.max(0, maxLine), code.split('\n').length);
      new RuntimeExecutor(state, effectiveMaxLine, fullProgram, options).executeProgram(program);
    } catch (e) {
      state.addDiagnostic(Math.max(1, maxLine), 'parser: ' + stdException(e).message);
    }

    return {
      variables: collectVariables(state.m_userVariableOrder, state.m_values, state.m_lastChangedLine),
      variableChanges: state.m_variableChanges.slice(),
      diagnostics: state.m_diagnostics.slice(),
      apiCalls: state.m_apiCalls.slice(),
      parameterRequests: state.m_parameterRequests.slice(),
    };
  }

  discoverParameters(code: string, options?: RuntimeExecutionOptions): RuntimeParameterRequest[] {
    return scanGetValParameters(code, options);
  }

  setParameters(parameters: ReadonlyMap<string, string>): void {
    this.m_state.m_parameters = new Map(parameters);
  }

  evaluateNumericExpression(expression: string): number {
    const snapshot = this.evaluationSnapshot();
    const field = trim(expression);
    if (field === '') throw runtimeError('enter a number, variable or expression');
    const value = snapshot.m_values.has(field)
      ? snapshot.m_values.get(field)
      : new ExprParser(Lexer.scanExpression(field), snapshot).parse();
    const number = runtimeNumber(value);
    if (!Number.isFinite(number)) throw runtimeError('value must be finite');

    return number;
  }

  private evaluationSnapshot(): RuntimeState {
    const state = this.m_state;
    const snapshot = new RuntimeState();
    for (const [name, value] of state.m_values) snapshot.m_values.set(name, runtimeDeepCopy(value));
    snapshot.m_functionMacros = new Map(state.m_functionMacros);
    for (const request of state.m_parameterRequests) {
      if (state.m_values.has(request.variableName) && !snapshot.m_values.has(request.name))
        snapshot.m_values.set(request.name, runtimeDeepCopy(state.m_values.get(request.variableName)));
    }

    return snapshot;
  }

  private seedBuiltinValues(): void {
    const state = this.m_state;
    state.setVariable('vx', new FdVector3d(1, 0, 0), false);
    state.setVariable('vy', new FdVector3d(0, 1, 0), false);
    state.setVariable('vz', new FdVector3d(0, 0, 1), false);
    for (const constant of kSdkConstants) {
      const value = constant.integer ? doubleToInt64(constant.value) : constant.value;
      // New immutable SDK constants need no variable lifetime/history. Preserve
      // existing trace identities when extending the SDK constant catalogue.
      if (constant.name.startsWith('enBowl')) state.m_values.set(constant.name, value);
      else state.setVariable(constant.name, value, false);
    }
    state.setVariable('cpx', 10n, false);
    state.setVariable('m_geoRepMode', 0n, false);
    state.setVariable('m_primitiveMode', 0n, false);
    state.m_values.set('TRUE', true);
    state.m_values.set('FALSE', false);
  }

  private importSourceMacros(code: string): void {
    const state = this.m_state;
    for (const lineText of code.split('\n')) {
      const definition = parseMacroDefinition(lineText);
      if (!definition) continue;
      if (definition.kind === 'function') {
        state.m_functionMacros.set(definition.name, definition.macro);
        continue;
      }
      try {
        const value = new ExprParser(Lexer.scanExpression(definition.expression), state).parse();
        state.setVariable(definition.name, value, false);
      } catch (e) {
        stdException(e);
      }
    }
  }
}

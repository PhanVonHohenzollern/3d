import { runtimeError, stdException, trim } from '@engine/runtime/cpp/cpp';
import { parseMacroDefinition } from '@engine/runtime/helpers/macros';
import { scanGetValParameters } from '@engine/runtime/analysis/parameterScan';
import { preprocess } from '@engine/runtime/interpreter/preprocessor';
import type { EvalContext } from '@engine/runtime/interpreter/evalContext';
import { evaluateExpression } from '@engine/runtime/interpreter/evaluator';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import { parseProgram } from '@engine/runtime/interpreter/ProgramParser';
import { RuntimeExecutor } from '@engine/runtime/interpreter/RuntimeExecutor';
import { RuntimeState } from '@engine/runtime/interpreter/RuntimeState';
import type { RuntimeExecutionOptions, RuntimeParameterRequest, RuntimeResult } from '@engine/runtime/RuntimeTypes';
import { runtimeNumber } from '@engine/runtime/RuntimeValue';
import { expressionIntrinsicCaller, seedSdkValues } from '@engine/runtime/intrinsics';

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
    seedSdkValues(this.m_state);

    try {
      const processed = preprocess(code);
      this.importSourceMacros(processed.definitions.join('\n'));
      const program = parseProgram(processed.code);
      const effectiveMaxLine = Math.min(Math.max(0, maxLine), code.split('\n').length);
      new RuntimeExecutor(state, effectiveMaxLine, fullProgram, options).executeProgram(program);
    } catch (e) {
      state.addDiagnostic(Math.max(1, maxLine), 'parser: ' + stdException(e).message);
    }

    return state.result();
  }

  discoverParameters(code: string, options?: RuntimeExecutionOptions): RuntimeParameterRequest[] {
    return scanGetValParameters(code, options);
  }

  setParameters(parameters: ReadonlyMap<string, string>): void {
    this.m_state.setParameters(parameters);
  }

  evaluateNumericExpression(expression: string): number {
    const snapshot = this.m_state.evaluationSnapshot();
    const field = trim(expression);
    if (field === '') throw runtimeError('enter a number, variable or expression');
    const value = snapshot.hasVariable(field)
      ? snapshot.lookupValue(field)
      : evaluateExpression(Lexer.scanExpression(field), withExpressionIntrinsics(snapshot));
    const number = runtimeNumber(value);
    if (!Number.isFinite(number)) throw runtimeError('value must be finite');

    return number;
  }

  private importSourceMacros(code: string): void {
    const state = this.m_state;
    for (const lineText of code.split('\n')) {
      const definition = parseMacroDefinition(lineText);
      if (!definition) continue;
      if (definition.kind === 'function') {
        state.defineFunctionMacro(definition.name, definition.macro);
        continue;
      }
      try {
        const value = evaluateExpression(Lexer.scanExpression(definition.expression), state);
        state.setVariable(definition.name, value, false);
      } catch (e) {
        stdException(e);
      }
    }
  }
}

// Outside a program run only the intrinsics that work inside expressions can be called.
function withExpressionIntrinsics(state: RuntimeState): EvalContext {
  const context: EvalContext = {
    lookupValue: (name) => state.lookupValue(name),
    functionMacro: (name) => state.functionMacro(name),
    withBindings: (bindings, evaluate) => state.withBindings(bindings, evaluate),
    callFunction: expressionIntrinsicCaller({
      state,
      evaluate: (tokens) => evaluateExpression(tokens, context),
      resolveLValue: () => {
        throw runtimeError('assignments are not available here');
      },
      parentApiIndex: () => -1,
    }),
  };

  return context;
}

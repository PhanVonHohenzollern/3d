import { resolveApiSignature } from '@engine/runtime/ApiMetadata';
import { runtimeError, stdException } from '@engine/runtime/cpp/cpp';
import { createApiCall } from '@engine/runtime/helpers/apiCalls';
import {
  functionArgumentRanks,
  functionParameters,
  functionScope,
  parameterDefaultExpression,
  parameterDefaultPos,
  parameterName,
  populateFormalParameterMetadata,
  requiredParameterCount,
  writableReferenceParameter,
  evaluateFunctionInput,
} from '@engine/runtime/helpers/functionSignatures';
import { TokKind, tokensToExpression, type Token } from '@engine/runtime/helpers/tokens';
import { readLValue, type LValueRef } from '@engine/runtime/helpers/lvalues';
import { pathSteps } from '@engine/runtime/interpreter/paths';
import { parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { recordChange } from '@engine/runtime/interpreter/changes';
import { freshControlFlow, kMaxFunctionCallDepth, type Execution } from '@engine/runtime/interpreter/execution';
import type { Statement } from '@engine/runtime/interpreter/Statement';
import { languageIntrinsic, sdkIntrinsic } from '@engine/runtime/intrinsics';
import type { RuntimeArgumentTrace, RuntimeValueSource } from '@engine/runtime/RuntimeTypes';
import { isArray, runtimeCoerceToType, runtimeDeepCopy, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import { debugPause } from '@engine/runtime/interpreter/FunctionDebug';
import { Lexer } from '@engine/runtime/interpreter/Lexer';

interface ReferenceOutput {
  index: number;
  value: RuntimeValue;
  sources: RuntimeValueSource[];
}

// Calls: SDK calls are recorded (after the intrinsics had their say); program functions run in a
// call frame of their own, with arguments bound and reference parameters written back.
export class FunctionCalls {
  constructor(private readonly x: Execution) {}

  call(name: string, argGroups: readonly Token[][], line: number, expression = false, baseCall = false): RuntimeValue {
    if (expression) {
      const intrinsic = languageIntrinsic(name)?.expression?.(this.x.intrinsics, { name, argGroups, line });
      if (intrinsic) return intrinsic.value;
    }
    line = this.x.lineOrCaller(line);
    const args: RuntimeValue[] = [];
    const references = new Map<number, LValueRef>();
    const candidates = baseCall ? undefined : this.x.functions.get(name);
    let hasUnresolvedArgument = false;
    argGroups.forEach((group, i) => {
      try {
        const path = pathSteps(group, 1);
        const reference =
          candidates?.some((fn) => {
            const param = functionParameters(fn)[i];

            return param && writableReferenceParameter(param);
          }) &&
          group[0]?.kind === TokKind.Identifier &&
          this.x.state.hasVariable(group[0].text) &&
          path.end === group.length &&
          !path.error &&
          path.steps.every((step) => step.kind !== 'call');
        if (reference) {
          const ref = this.x.resolveLValue(group);
          references.set(i, ref);
          args.push(readLValue(ref));
        } else args.push(runtimeDeepCopy(this.x.evaluate(group)));
      } catch (e) {
        if (e === debugPause) throw e;
        this.x.state.addDiagnostic(
          line,
          `cannot evaluate argument ${i + 1} of ${name} (${tokensToExpression(group)}): ${stdException(e).message}`,
        );
        args.push(undefined);
        hasUnresolvedArgument = true;
      }
    });
    const call = createApiCall(name, line, this.x.parentApiIndex(), [...args], argGroups.map(tokensToExpression));

    const fn = baseCall ? null : this.resolveUserFunction(name, args);
    if (fn) {
      call.userFunctionCall = true;
      populateFormalParameterMetadata(call, fn);
      const functionIndex = this.x.state.recordApiCall(call);
      if (!hasUnresolvedArgument) return this.executeUserFunction(fn, args, argGroups, functionIndex, references);

      return;
    }
    const intrinsic = sdkIntrinsic(name);
    if (intrinsic?.value) return intrinsic.value(this.x.intrinsics, { name, argGroups, line }, args);
    if (expression) throw runtimeError('unsupported expression function: ' + name);
    intrinsic?.update?.(this.x.intrinsics, { name, argGroups, line }, args);
    const signature = resolveApiSignature(call);
    if (!signature && /^(make|add|draw)/.test(name)) {
      this.x.state.addDiagnostic(line, 'unknown native geometry API: ' + name);

      return;
    }
    this.x.state.recordApiCall(call, signature);
  }

  private resolveUserFunction(name: string, args: readonly RuntimeValue[]): Statement | null {
    const candidates = this.x.functions.get(name);
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
    selected: boolean,
  ): RuntimeValue[] {
    return functionParameters(fn).map((param, i) => {
      const name = parameterName(param);
      if (name === '') return;
      let value: RuntimeValue = undefined;
      if (i < args.length) value = runtimeDeepCopy(args[i]);
      else if (parameterDefaultPos(param) < param.length) {
        try {
          value = runtimeDeepCopy(this.x.evaluate(parameterDefaultExpression(param)));
        } catch (e) {
          if (e === debugPause) throw e;
          stdException(e);
          value = undefined;
        }
      }
      const parsed = parseRuntimeType(param, 0);
      const configured = selected ? this.x.options?.arguments?.get(name) : undefined;
      if (configured !== undefined)
        value = evaluateFunctionInput(param, Lexer.scanExpression(configured), (tokens) => this.x.evaluate(tokens));
      if (parsed && value !== undefined && !isArray(value)) value = runtimeCoerceToType(value, parsed.type);
      const trace = configured === undefined && i < traces.length ? traces[i] : null;
      const expression =
        configured ?? (trace ? trace.expression : tokensToExpression(parameterDefaultExpression(param)));
      this.x.state.setVariable(name, value, selected, fn.startLine, 'bind', expression, trace);

      return runtimeDeepCopy(value);
    });
  }

  private executeUserFunction(
    fn: Statement,
    args: readonly RuntimeValue[],
    argumentTokens: readonly Token[][],
    parentApiIndex: number,
    references: ReadonlyMap<number, LValueRef>,
  ): RuntimeValue {
    if (this.x.callDepth >= kMaxFunctionCallDepth) throw runtimeError('C++ function call depth exceeded 64');

    const state = this.x.state;
    const frame = state.pushFrame(functionScope(fn, this.x.functions.get(fn.functionName)!, this.x.options));
    const callerFlow = this.x.flow;
    this.x.flow = freshControlFlow();
    ++this.x.callDepth;
    const selected = this.x.debug.enter(fn, parentApiIndex, this.x.callDepth);
    this.x.pushParentApi(parentApiIndex);
    let outputs: ReferenceOutput[];
    let returned: RuntimeValue;
    try {
      const call = state.apiCall(parentApiIndex)!;
      call.boundArguments = this.bindFunctionArguments(fn, args, call.argumentTraces, selected);
      if (selected)
        call.formalParameterNames.forEach((name, index) => {
          const configured = this.x.options?.arguments?.get(name);
          if (configured === undefined) return;
          call.argumentTraces[index] = { expression: configured, sources: [], elements: [] };
        });
      if (fn.body) this.x.executeBody(fn.body);
      if (selected) this.x.debug.pause();
      outputs = this.referenceOutputs(fn, argumentTokens.length);
      const returnType = parseRuntimeType(fn.signature, 0);
      const { returnValue } = this.x.flow;
      returned = runtimeDeepCopy(
        returnType && returnValue !== undefined ? runtimeCoerceToType(returnValue, returnType.type) : returnValue,
      );
    } catch (error) {
      if (!selected || error === debugPause) throw error;
      state.addDiagnostic(fn.startLine, stdException(error).message);
      this.x.debug.pause();
    } finally {
      this.x.popParentApi();
      --this.x.callDepth;
      if (!this.x.debug.paused) state.popFrame(frame);
      this.x.flow = callerFlow;
    }

    const callLine = state.apiCall(parentApiIndex)?.line ?? fn.startLine;
    for (const output of outputs)
      this.writeBackReference(fn, callLine, argumentTokens[output.index], output, references.get(output.index));

    return returned;
  }

  private referenceOutputs(fn: Statement, argumentCount: number): ReferenceOutput[] {
    const outputs: ReferenceOutput[] = [];
    const params = functionParameters(fn);
    for (let i = 0; i < params.length && i < argumentCount; ++i) {
      if (!writableReferenceParameter(params[i])) continue;
      const name = parameterName(params[i]);
      if (name === '' || !this.x.state.hasVariable(name)) continue;
      outputs.push({
        index: i,
        value: this.x.state.lookupValue(name),
        sources: this.x.state.captureValueSources(name),
      });
    }

    return outputs;
  }

  private writeBackReference(
    fn: Statement,
    callLine: number,
    target: readonly Token[],
    output: ReferenceOutput,
    reference?: LValueRef,
  ): void {
    try {
      recordChange(
        this.x.state,
        reference ?? this.x.resolveLValue(target),
        {
          line: callLine,
          operation: 'reference write-back',
          expression: fn.functionName,
          sources: output.sources,
          onlyIfChanged: true,
        },
        () => output.value,
      );
    } catch (e) {
      this.x.state.addDiagnostic(
        callLine,
        'cannot write back reference parameter of ' + fn.functionName + ': ' + stdException(e).message,
      );
    }
  }
}

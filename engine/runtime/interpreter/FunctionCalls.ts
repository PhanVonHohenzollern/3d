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
} from '@engine/runtime/helpers/functionSignatures';
import { tokensToExpression, type Token } from '@engine/runtime/helpers/tokens';
import { parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { recordChange } from '@engine/runtime/interpreter/changes';
import { freshControlFlow, kMaxFunctionCallDepth, type Execution } from '@engine/runtime/interpreter/execution';
import type { Statement } from '@engine/runtime/interpreter/Statement';
import { languageIntrinsic, sdkIntrinsic } from '@engine/runtime/intrinsics';
import type { RuntimeArgumentTrace, RuntimeValueSource } from '@engine/runtime/RuntimeTypes';
import { isArray, runtimeCoerceToType, runtimeDeepCopy, type RuntimeValue } from '@engine/runtime/RuntimeValue';

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
    let hasUnresolvedArgument = false;
    argGroups.forEach((group, i) => {
      try {
        args.push(runtimeDeepCopy(this.x.evaluate(group)));
      } catch (e) {
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
      if (!hasUnresolvedArgument) return this.executeUserFunction(fn, args, argGroups, functionIndex);

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
  ): void {
    functionParameters(fn).forEach((param, i) => {
      const name = parameterName(param);
      if (name === '') return;
      let value: RuntimeValue = undefined;
      if (i < args.length) value = runtimeDeepCopy(args[i]);
      else if (parameterDefaultPos(param) < param.length) {
        try {
          value = runtimeDeepCopy(this.x.evaluate(parameterDefaultExpression(param)));
        } catch (e) {
          stdException(e);
          value = undefined;
        }
      }
      const parsed = parseRuntimeType(param, 0);
      if (parsed && value !== undefined && !isArray(value)) value = runtimeCoerceToType(value, parsed.type);
      const trace = i < traces.length ? traces[i] : null;
      const expression = trace ? trace.expression : tokensToExpression(parameterDefaultExpression(param));
      this.x.state.setVariable(name, value, false, fn.startLine, 'bind', expression, trace);
    });
  }

  private executeUserFunction(
    fn: Statement,
    args: readonly RuntimeValue[],
    argumentTokens: readonly Token[][],
    parentApiIndex: number,
  ): RuntimeValue {
    if (this.x.callDepth >= kMaxFunctionCallDepth) throw runtimeError('C++ function call depth exceeded 64');

    const state = this.x.state;
    const frame = state.pushFrame(functionScope(fn, this.x.functions.get(fn.functionName)!, this.x.options));
    const callerFlow = this.x.flow;
    this.x.flow = freshControlFlow();
    ++this.x.callDepth;
    this.x.pushParentApi(parentApiIndex);
    let outputs: ReferenceOutput[];
    let returned: RuntimeValue;
    try {
      this.bindFunctionArguments(fn, args, state.apiCall(parentApiIndex)?.argumentTraces ?? []);
      if (fn.body) this.x.executeBody(fn.body);
      outputs = this.referenceOutputs(fn, argumentTokens.length);
      const returnType = parseRuntimeType(fn.signature, 0);
      const { returnValue } = this.x.flow;
      returned = runtimeDeepCopy(
        returnType && returnValue !== undefined ? runtimeCoerceToType(returnValue, returnType.type) : returnValue,
      );
    } finally {
      this.x.popParentApi();
      --this.x.callDepth;
      state.popFrame(frame);
      this.x.flow = callerFlow;
    }

    const callLine = state.apiCall(parentApiIndex)?.line ?? fn.startLine;
    for (const output of outputs) this.writeBackReference(fn, callLine, argumentTokens[output.index], output);

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

  private writeBackReference(fn: Statement, callLine: number, target: readonly Token[], output: ReferenceOutput): void {
    try {
      recordChange(
        this.x.state,
        this.x.resolveLValue(target),
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

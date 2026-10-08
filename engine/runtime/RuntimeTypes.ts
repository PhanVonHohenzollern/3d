import type { ApiSignatureMetadata } from '@engine/runtime/ApiMetadata.types';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

export interface RuntimeVariable {
  name: string;
  value: RuntimeValue;
  lastChangedLine: number;
}

export interface RuntimeValueSource {
  name: string;
  value: RuntimeValue;
  variableId: number;
  historyEnd: number;
}

export interface RuntimeArgumentTrace {
  expression: string;
  sources: RuntimeValueSource[];
  elements: RuntimeArgumentTrace[];
}

export interface RuntimeVariableChange {
  line: number;
  name: string;
  operation: string;
  expression: string;
  before: RuntimeValue;
  after: RuntimeValue;
  variableId: number;
  sources: RuntimeValueSource[];
}

export interface RuntimeDiagnostic {
  line: number;
  message: string;
}

export interface RuntimeApiCall {
  // The SDK overload the arguments select, resolved once when the call is recorded.
  signature: ApiSignatureMetadata | null;
  line: number;
  parentApiIndex: number;
  userFunctionCall: boolean;
  name: string;
  arguments: RuntimeValue[];
  boundArguments?: RuntimeValue[];
  argumentExpressions: string[];
  formalParameterNames: string[];
  formalParameterTypes: string[];
  display: string;
  argumentTraces: RuntimeArgumentTrace[];
}

export interface RuntimeParameterRequest {
  functionName?: string;
  checkbox?: boolean;
  branchSelector?: 'switch' | 'condition';
  name: string;
  type: string;
  defaultValue: string;
  currentValue: string;
  sourceFunction: string;
  variableName: string;
  line: number;
}

export function parameterKey(request: Pick<RuntimeParameterRequest, 'name' | 'functionName'>): string {
  return request.functionName ? `${request.functionName}::${request.name}` : request.name;
}

export interface RuntimeResult {
  debugApiIndex?: number;
  variables: RuntimeVariable[];
  variableChanges: RuntimeVariableChange[];
  diagnostics: RuntimeDiagnostic[];
  apiCalls: RuntimeApiCall[];
  parameterRequests: RuntimeParameterRequest[];
}

export function emptyRuntimeResult(): RuntimeResult {
  return { variables: [], variableChanges: [], diagnostics: [], apiCalls: [], parameterRequests: [] };
}

export function emptyApiCall(): RuntimeApiCall {
  return {
    line: 0,
    parentApiIndex: -1,
    userFunctionCall: false,
    name: '',
    arguments: [],
    argumentExpressions: [],
    formalParameterNames: [],
    formalParameterTypes: [],
    display: '',
    argumentTraces: [],
    signature: null,
  };
}

export interface RuntimeExecutionOptions {
  entryFunction?: string | null;
  entrySignature?: string;
  functionScopes?: ReadonlyMap<string, string>;
  arguments?: ReadonlyMap<string, string>;
  isolated?: boolean;
  debugCall?: { signature: string; occurrence: number; line?: number };
}

export function debugApiIndices(result: RuntimeResult): Set<number> | undefined {
  if (result.debugApiIndex === undefined) return;
  const indices = new Set([result.debugApiIndex]);
  result.apiCalls.forEach((call, index) => {
    if (indices.has(call.parentApiIndex)) indices.add(index);
  });

  return indices;
}

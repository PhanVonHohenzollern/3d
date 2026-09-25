import type { RuntimeValue } from './RuntimeValue';

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
  line: number;
  parentApiIndex: number;
  userFunctionCall: boolean;
  name: string;
  arguments: RuntimeValue[];
  argumentExpressions: string[];
  formalParameterNames: string[];
  formalParameterTypes: string[];
  display: string;
  argumentTraces: RuntimeArgumentTrace[];
}

export interface RuntimeParameterRequest {
  functionName?: string;
  checkbox?: boolean;
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
  };
}

export interface RuntimeExecutionOptions {
  entryFunction?: string | null;
  arguments?: ReadonlyMap<string, string>;
  isolated?: boolean;
}

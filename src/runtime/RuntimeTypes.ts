// Result structures of runtime/GeometryRuntime.h. The interpreter itself is
// in GeometryRuntime.ts. std::size_t fields are plain numbers.

import type { RuntimeValue } from './RuntimeValue';

export interface RuntimeVariable {
  name: string;
  value: RuntimeValue;
  lastChangedLine: number;
}

/**
 * A variable value at the instant an expression was evaluated. The lifetime ID
 * separates repeated local declarations; historyEnd excludes all later writes.
 */
export interface RuntimeValueSource {
  name: string;
  value: RuntimeValue;
  variableId: number; // -1 when not a tracked variable
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
  /**
   * True when this call resolves to a C++ function body found in the
   * currently parsed source, rather than a native preview API adapter.
   */
  userFunctionCall: boolean;
  name: string;
  arguments: RuntimeValue[];
  /** Original source expressions for each argument (provenance). */
  argumentExpressions: string[];
  /** From the parsed declaration for user calls; native calls use ApiMetadata. */
  formalParameterNames: string[];
  formalParameterTypes: string[];
  display: string;
  argumentTraces: RuntimeArgumentTrace[];
}

export interface RuntimeParameterRequest {
  name: string;
  type: string;
  defaultValue: string;
  currentValue: string;
  sourceFunction: string;
  variableName: string;
  line: number;
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
    line: 0, parentApiIndex: -1, userFunctionCall: false, name: '', arguments: [],
    argumentExpressions: [], formalParameterNames: [], formalParameterTypes: [], display: '', argumentTraces: [],
  };
}

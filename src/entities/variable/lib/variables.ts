import type { RuntimeResult, RuntimeVariable } from '@engine/runtime';
import { runtimeTypeName, runtimeValueToString } from '@engine/runtime';
import type { VariableRow } from '@/entities/variable/model/types';

export function variableSummary(result: RuntimeResult, currentLine: number): string {
  return (
    `State after line ${currentLine}  |  ${result.variables.length} variable(s)  |  ` +
    `${result.variableChanges.length} change(s)  |  ${result.diagnostics.length} diagnostic(s)`
  );
}

export function variableRow(variable: RuntimeVariable): VariableRow {
  return {
    name: variable.name,
    type: runtimeTypeName(variable.value),
    value: runtimeValueToString(variable.value),
    changed: variable.lastChangedLine > 0 ? `line ${variable.lastChangedLine}` : '',
  };
}

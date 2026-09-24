import type { RuntimeResult, RuntimeValueSource, RuntimeVariable } from '../RuntimeTypes';
import { isArray, runtimeDeepCopy, type RuntimeValue } from '../RuntimeValue';
import { containsPath } from './variablePaths';

export function collectVariables(
  order: readonly string[],
  values: ReadonlyMap<string, RuntimeValue>,
  lastChangedLine: ReadonlyMap<string, number>,
): RuntimeVariable[] {
  const variables: RuntimeVariable[] = [];

  const append = (name: string, value: RuntimeValue, depth: number): void => {
    variables.push({ name, value: runtimeDeepCopy(value), lastChangedLine: lastChangedLine.get(name) ?? 0 });
    if (depth > 4 || !isArray(value)) return;
    const limit = Math.min(value.elements.length, 64);
    for (let i = 0; i < limit; ++i) append(`${name}[${i}]`, value.elements[i], depth + 1);
  };

  for (const name of order) if (values.has(name)) append(name, values.get(name), 0);

  return variables;
}

export function runtimeSourceHistory(result: RuntimeResult, source: RuntimeValueSource): number[] {
  const history: number[] = [];
  if (source.variableId < 0) return history;
  const end = Math.min(source.historyEnd, result.variableChanges.length);
  for (let i = 0; i < end; ++i) {
    const change = result.variableChanges[i];
    if (change.variableId !== source.variableId) continue;
    if (
      (change.operation === 'declare' || change.operation === 'bind') &&
      isArray(change.after) &&
      containsPath(change.name, source.name)
    )
      continue;
    if (change.name === source.name || containsPath(change.name, source.name) || containsPath(source.name, change.name))
      history.push(i);
  }

  return history;
}

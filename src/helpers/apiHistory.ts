import { runtimeSourceHistory } from '../core/runtime/GeometryRuntime';
import type { RuntimeResult, RuntimeValueSource } from '../core/runtime/RuntimeTypes';
import { isUnset, runtimeValueToCompactString, type RuntimeValue } from '../core/runtime/RuntimeValue';

export function historyValueText(value: RuntimeValue): string {
  return isUnset(value) ? '\u2014' : runtimeValueToCompactString(value);
}

export function earlierChanges(result: RuntimeResult, sources: readonly RuntimeValueSource[]): number[] {
  const changes = new Set<number>();
  const visited = new Set<string>();
  const pending = [...sources];
  while (pending.length) {
    const source = pending.pop()!;
    const key = JSON.stringify([source.variableId, source.name, source.historyEnd]);
    if (visited.has(key)) continue;
    visited.add(key);
    const history = runtimeSourceHistory(result, source);
    for (let i = 0; i < history.length; ++i) {
      if (i + 1 < history.length) changes.add(history[i]);
      pending.push(...result.variableChanges[history[i]].sources);
    }
  }

  return [...changes].sort((a, b) => b - a);
}

export function historyWindowTitle(apiIndex: number, name: string, line: number): string {
  return `Earlier values - API #${apiIndex + 1} ${name} - line ${line}`;
}

import { parameterKey, type RuntimeParameterRequest } from '@engine/runtime';
import type { ResolvedSnapshot } from '@/features/element-library/model/constraintGraph';

// One committed JSON snapshot feeds both the main interpreter and sub-function trace.
// Non-library runtime inputs (e.g. insulation) are deliberately preserved.
export function resolvedRuntimeParameters(
  overrides: ReadonlyMap<string, string>,
  requests: readonly RuntimeParameterRequest[],
  snapshot?: ResolvedSnapshot,
): Map<string, string> {
  const parameters = new Map(overrides);
  if (!snapshot) return parameters;
  if (snapshot.status !== 'valid') throw new Error(`Cannot execute a ${snapshot.status} library snapshot`);
  if (snapshot.missingInputs?.length)
    throw new Error(`Enter dimensions in Parameters: ${snapshot.missingInputs.join(', ')}`);

  const values = snapshot.resolvedValues;
  // Replace JSON-bound inputs, including scoped get_val copies. Inputs only
  // declared by C++ keep their source defaults or current editor overrides.
  // Selecting an entity resets the panel; sharing an entry does not make its
  // other cases' JSON values defaults for this entity.
  for (const key of parameters.keys()) {
    const scopeSeparator = key.lastIndexOf('::');
    const plain = scopeSeparator >= 0 ? key.slice(scopeSeparator + 2) : key;
    if (values.has(key) || values.has(plain)) parameters.delete(key);
  }
  for (const [name, value] of values) parameters.set(name, value);

  // Bind every get_val name actually present in the committed JSON snapshot.
  // Static discovery includes get_val calls in *inactive* C++ case branches;
  // missing names must instead be validated against executed requests before
  // a scene is published. Never synthesize C++ defaults for missing JSON names.
  for (const request of requests) {
    if (request.sourceFunction !== 'get_val') continue;
    const value = values.get(request.name);
    if (value !== undefined) parameters.set(parameterKey(request), value);
  }

  return parameters;
}

/**
 * Inspection after executing the selected C++ branch. Shared constructors
 * legitimately query names used by other entities; a missing JSON binding is
 * diagnostic, NOT proof that every generated mesh is unusable. Do not invent
 * an alias, zero, or a value from a different library/case.
 */
export function inspectExecutedGetVals(
  executed: readonly {
    sourceFunction: string;
    name: string;
    type?: string;
    consumed?: boolean;
    initializedFromSource?: boolean;
  }[],
  snapshot: ResolvedSnapshot,
): { missing: string[]; invalid: string[] } {
  const missing = new Set<string>();
  const invalid = new Set<string>();
  for (const request of executed) {
    if (request.sourceFunction !== 'get_val' || request.consumed === false) continue;
    const value = snapshot.resolvedValues.get(request.name);
    if (value === undefined) {
      // Native get_val keeps an explicit source initializer/assignment on a
      // failed lookup. A shared-function query without one is still only a
      // warning: variable-level reads do not establish mesh-level dependency.
      if (request.initializedFromSource !== true) missing.add(request.name);
      continue;
    }
    if (
      ['double', 'float', 'int', 'long', 'short'].includes(request.type ?? '') &&
      (!value.trim() || !Number.isFinite(Number(value)))
    )
      invalid.add(request.name);
  }

  return { missing: [...missing], invalid: [...invalid] };
}

/** Compatibility helper: potential binding issues, never a rendering gate. */
export function missingExecutedGetVals(
  executed: Parameters<typeof inspectExecutedGetVals>[0],
  snapshot: ResolvedSnapshot,
): string[] {
  const issues = inspectExecutedGetVals(executed, snapshot);

  return [...new Set([...issues.missing, ...issues.invalid])];
}

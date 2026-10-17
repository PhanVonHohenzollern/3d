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

  const values = snapshot.resolvedValues;
  // Remove old scoped copies, including keys left by previous case/trace builds.
  // Never allow those copies to override the committed JSON values.
  for (const key of parameters.keys()) {
    if (values.has(key) || (key.includes('::') && values.has(key.slice(key.lastIndexOf('::') + 2))))
      parameters.delete(key);
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
 * Execute-time check used after the interpreter reports get_val requests.
 * It is not valid to call this with the static discoverParameters() result.
 */
export function missingExecutedGetVals(
  executed: readonly { sourceFunction: string; name: string; type?: string }[],
  snapshot: ResolvedSnapshot,
): string[] {
  return [
    ...new Set(
      executed
        .filter((request) => {
          if (request.sourceFunction !== 'get_val') return false;
          const value = snapshot.resolvedValues.get(request.name);
          if (value === undefined) return true;

          // Text may deliberately be empty. Numeric destinations must not silently
          // keep a C++ initializer when an empty/non-numeric JSON value is passed.
          return (
            ['double', 'float', 'int', 'long', 'short'].includes(request.type ?? '') &&
            (!value.trim() || !Number.isFinite(Number(value)))
          );
        })
        .map((request) => request.name),
    ),
  ];
}

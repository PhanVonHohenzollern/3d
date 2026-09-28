import type { ApiSignatureMetadata } from '@engine/runtime/ApiMetadata';
import type { RuntimeApiCall } from '@engine/runtime/RuntimeTypes';

export function isGeometryCallName(name: string): boolean {
  return name.startsWith('make') || name.startsWith('add') || name.startsWith('draw');
}

export function warningFor(call: RuntimeApiCall, reason: string): string {
  return `line ${call.line} ${call.name}: ${reason}`;
}

export function parameterIndex(sig: ApiSignatureMetadata | null, name: string): number {
  if (!sig) return -1;
  for (let i = 0; i < sig.parameters.length; ++i) if (sig.parameters[i].name === name) return i;

  return -1;
}

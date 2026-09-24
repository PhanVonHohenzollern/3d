import { stod, stoll } from '../../../utils/cpp';
import {
  apiSignatureMetadataForCall,
  type ApiParameterMetadata,
  type ApiSignatureMetadata,
} from '../../runtime/ApiMetadata';
import type { RuntimeApiCall } from '../../runtime/RuntimeTypes';
import { runtimeDeepCopy, runtimeDefaultValueForType, type RuntimeValue } from '../../runtime/RuntimeValue';

export function isGeometryCallName(name: string): boolean {
  return name.startsWith('make') || name.startsWith('add') || name.startsWith('draw');
}

export function warningFor(call: RuntimeApiCall, reason: string): string {
  return `line ${call.line} ${call.name}: ${reason}`;
}

function parseNumericDefault(type: string, text: string): RuntimeValue {
  try {
    if (type.includes('int') || type.includes('short') || type.includes('long')) {
      const integer = stoll(text);
      if (integer.used === text.length) return integer.value;
    }
    const real = stod(text);
    return real.used === text.length ? real.value : undefined;
  } catch {
    return undefined;
  }
}

function parseDefaultValue(parameter: ApiParameterMetadata): RuntimeValue {
  const text = parameter.defaultValue;
  if (text === '') return runtimeDefaultValueForType(parameter.type);
  if (text === 'true') return true;
  if (text === 'false') return false;
  return parseNumericDefault(parameter.type, text) ?? runtimeDefaultValueForType(parameter.type);
}

export function parameterIndex(sig: ApiSignatureMetadata | null, name: string): number {
  if (!sig) return -1;
  for (let i = 0; i < sig.parameters.length; ++i) if (sig.parameters[i].name === name) return i;
  return -1;
}

export function effectiveArguments(call: RuntimeApiCall): RuntimeValue[] {
  const args: RuntimeValue[] = [];
  for (const arg of call.arguments) args.push(runtimeDeepCopy(arg));
  const sig = apiSignatureMetadataForCall(call);
  if (sig) {
    for (let i = args.length; i < sig.parameters.length; ++i) args.push(parseDefaultValue(sig.parameters[i]));
  }
  return args;
}

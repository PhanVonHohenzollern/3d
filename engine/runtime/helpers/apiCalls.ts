import { emptyApiCall, type RuntimeApiCall } from '@engine/runtime/RuntimeTypes';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

export function createApiCall(
  name: string,
  line: number,
  parentApiIndex: number,
  args: RuntimeValue[],
  argumentExpressions: string[],
): RuntimeApiCall {
  const call = emptyApiCall();
  call.line = line;
  call.parentApiIndex = parentApiIndex;
  call.name = name;
  call.arguments = args;
  call.argumentExpressions = argumentExpressions;
  call.display = `${name}(${argumentExpressions.join(', ')});`;

  return call;
}

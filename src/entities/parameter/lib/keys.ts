import { isInsulationQuery, parameterKey, type RuntimeParameterRequest } from '@engine/runtime';

export function isFunctionParameterKey(key: string, functionName: string): boolean {
  return key.startsWith(parameterKey({ functionName, name: '' }));
}

export function parameterSlotCount(request: Pick<RuntimeParameterRequest, 'sourceFunction'>): number {
  return isInsulationQuery(request.sourceFunction) ? 2 : 1;
}

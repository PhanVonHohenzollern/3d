import { isInsulationQuery, parameterKey, type RuntimeParameterRequest } from '@engine/runtime';

export function isFunctionParameterKey(key: string, functionName: string): boolean {
  return key.startsWith(parameterKey({ functionName, name: '' }));
}

export function isConnectorQuery(request: Pick<RuntimeParameterRequest, 'sourceFunction'>): boolean {
  return ['get_ext_diam', 'get_fln_size', 'get_fln_thick', 'get_fln_diam', 'get_ldist'].includes(
    request.sourceFunction,
  );
}

export function parameterSlotCount(request: Pick<RuntimeParameterRequest, 'sourceFunction'>): number {
  if (isConnectorQuery(request)) return 0;

  return isInsulationQuery(request.sourceFunction) ? 2 : 1;
}

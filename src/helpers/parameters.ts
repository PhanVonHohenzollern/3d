import type { RuntimeParameterRequest } from '../core/runtime/RuntimeTypes';

export function neutralValueForType(type: string): string {
  if (type === 'bool') return 'false';
  if (type === 'string') return '';

  return '0';
}

export function definitionId(request: RuntimeParameterRequest): string {
  return `${request.name}\n${request.variableName}`;
}

export function parameterSeed(definition: RuntimeParameterRequest): string {
  let seed = definition.defaultValue;
  if (seed === '' && definition.type !== 'string') seed = definition.currentValue;
  if (seed === '' && definition.type !== 'string') seed = neutralValueForType(definition.type);

  return seed;
}

export function refinedParameterValue(request: RuntimeParameterRequest): string | null {
  let refined = request.defaultValue;
  if (refined === '' && request.type !== 'string') refined = request.currentValue;

  return refined !== '' || request.type === 'string' ? refined : null;
}

export function parameterRowTexts(definition: RuntimeParameterRequest, value: string): string[] {
  return [definition.name, definition.type, definition.variableName, value, String(definition.line)];
}

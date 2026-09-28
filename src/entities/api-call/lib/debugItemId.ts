export function apiDebugItemId(apiIndex: number, kind: 'point' | 'vector', parameterName: string): string {
  return `@api${apiIndex}:${kind}:${parameterName}`;
}

export const isApiDebugItemId = (id: string) => id.startsWith('@api');

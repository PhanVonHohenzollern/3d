import { kSdkConstants, kSdkTypes } from './SdkDefinitions.generated';

export interface SdkConstantDefinition {
  name: string;
  value: number;
  integer: boolean;
}

export interface SdkTypeDefinition {
  name: string;
  baseType: string;
  arrayExtent: number;
}

export { kSdkConstants, kSdkTypes };

const typesByName = new Map<string, SdkTypeDefinition>();
for (const type of kSdkTypes) if (!typesByName.has(type.name)) typesByName.set(type.name, type);

export function sdkTypeDefinition(name: string): SdkTypeDefinition | undefined {
  return typesByName.get(name);
}

export function sdkCanonicalType(name: string): string {
  const type = sdkTypeDefinition(name);
  if (type && !type.arrayExtent) return type.baseType;

  return name;
}

import { kSdkConstants as generatedConstants, kSdkTypes as generatedTypes } from './SdkDefinitions.generated';

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

export const kSdkConstants: readonly SdkConstantDefinition[] = [
  ...generatedConstants,
  ...['enBowlTrStraight', 'enBowlTrSpline', 'enBowlTrEllipse'].flatMap((name, value) =>
    [name, 'enBowlTransition::' + name].map((name) => ({ name, value, integer: true })),
  ),
];
export const kSdkTypes: readonly SdkTypeDefinition[] = [
  ...generatedTypes,
  { name: 'enBowlTransition', baseType: 'int', arrayExtent: 0 },
  { name: 'WCHAR', baseType: 'char', arrayExtent: 0 },
  { name: 'wchar_t', baseType: 'char', arrayExtent: 0 },
  { name: 'BOOL', baseType: 'bool', arrayExtent: 0 },
  { name: 'AcGePoint3d', baseType: 'FdPoint3d', arrayExtent: 0 },
  { name: 'AcGeVector3d', baseType: 'FdVector3d', arrayExtent: 0 },
];

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

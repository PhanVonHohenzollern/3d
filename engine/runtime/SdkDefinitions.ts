import {
  kSdkConstants as generatedConstants,
  kSdkTypes as generatedTypes,
} from '@engine/runtime/SdkDefinitions.generated';

export type { SdkConstantDefinition, SdkTypeDefinition } from '@engine/runtime/SdkDefinitions.types';
import type { SdkConstantDefinition, SdkTypeDefinition } from '@engine/runtime/SdkDefinitions.types';

export const kSdkConstants: readonly SdkConstantDefinition[] = [
  ...generatedConstants,
  { name: 'RCFlange', value: 45, integer: true },
  { name: 'concpx', value: 5, integer: true },
  ...['enBowlTrStraight', 'enBowlTrSpline', 'enBowlTrEllipse'].flatMap((name, value) =>
    [name, 'enBowlTransition::' + name].map((name) => ({ name, value, integer: true })),
  ),
];
export const kSdkTypes: readonly SdkTypeDefinition[] = [
  ...generatedTypes,
  { name: 'enBowlTransition', baseType: 'int', arrayExtent: 0 },
  { name: 'CHAR', baseType: 'char', arrayExtent: 0 },
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

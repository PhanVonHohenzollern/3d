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

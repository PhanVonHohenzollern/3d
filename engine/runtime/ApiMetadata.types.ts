export interface ApiParameterMetadata {
  name: string;
  type: string;
  defaultValue: string;
}

export interface ApiSignatureMetadata {
  name: string;
  returnType: string;
  sourceHeader: string;
  requiredParameterCount: number;
  parameters: ApiParameterMetadata[];
}

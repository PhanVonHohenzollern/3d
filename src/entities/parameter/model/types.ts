export interface ParameterRow {
  functionName?: string;
  key: string;
  line: number;
  texts: string[];
  checkbox?: boolean;
  disabled?: boolean;
}
export interface ParameterEditor {
  row: number;
  text: string;
  serial: number;
}

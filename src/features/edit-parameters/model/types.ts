export type ParameterTableDialogState = {
  text: string;
  cells: string[][];
  columnCount: number;
  parameterNames: string[];
  error: string;
  summary: string;
  canApply: boolean;
  close: () => void;
  setText: (text: string) => void;
  editCell: (row: number, column: number, value: string) => void;
  apply: () => void;
};

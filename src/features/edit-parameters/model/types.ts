import type { ParameterPanelModel } from '@/features/edit-parameters/model/ParameterPanelModel';
import type { RuntimeParameterRequest, RuntimeResult } from '@engine/runtime';

export type ParameterAvailability = (parameters: ReadonlyMap<string, string>) => ReadonlySet<string> | null;

export interface ParameterPanelHandle {
  setPlaceholderData(): void;
  setDefinitions(definitions: readonly RuntimeParameterRequest[]): void;
  setAvailability(query: ParameterAvailability | null): void;
  updateRuntimeResult(result: RuntimeResult): void;
  values(): Map<string, string>;
  overrides(): Map<string, string>;
  commitEditor(): void;
  selectTab(id: string): void;
  forgetFunction(name: string): void;
}

export interface ParameterPanelProps {
  model: ParameterPanelModel;
  onApply?: () => void;
}

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

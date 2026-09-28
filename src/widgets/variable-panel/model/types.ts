import type { RuntimeResult } from '@engine/runtime';
import type { VariablePanelModel } from '@/widgets/variable-panel/model/VariablePanelModel';

export interface VariablePanelHandle {
  setRuntimeResult(result: RuntimeResult, currentLine: number): void;
  selectVariable(name: string): void;
  selectedVariable(): string;
}

export interface VariablePanelProps {
  model: VariablePanelModel;
}

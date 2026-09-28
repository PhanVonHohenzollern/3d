import type { Ref } from 'react';
import type { RuntimeResult } from '@engine/runtime';

export interface VariablePanelHandle {
  setRuntimeResult(result: RuntimeResult, currentLine: number): void;
  selectVariable(name: string): void;
  selectedVariable(): string;
}

export interface VariablePanelProps {
  onSelectionChanged?: (name: string) => void;
  ref?: Ref<VariablePanelHandle>;
}

import type { Ref } from 'react';
import type { RuntimeResult } from '@engine/runtime';

export interface ApiTracePanelHandle {
  setPlaceholderData(): void;
  setRuntimeResult(result: RuntimeResult): void;
  selectMeshApiCall(apiIndex: number): void;
  meshApiCall(): number;
  selectDebugItems(names: ReadonlySet<string>): void;
  clearApiFocus(): void;
  selectedApiCall(): number;
  selectedDebugItems(): Set<string>;
  selectedApiCalls(): Set<number>;
  selectedSourceLines(): Set<number>;
}

export interface ApiTracePanelProps {
  onSelectionChanged?: (apiIndex: number) => void;
  onFunctionActivated?: (apiIndex: number) => void;
  onSourceActivated?: (line: number) => void;
  onHistorySourceActivated?: (line: number) => void;
  ref?: Ref<ApiTracePanelHandle>;
}

import type { RuntimeResult } from '@engine/runtime';
import type { ApiTracePanelModel } from '@/widgets/api-trace-panel/model/ApiTracePanelModel';

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
  model: ApiTracePanelModel;
}

import type { Ref } from 'react';
import type { ConnectorExpressionEvaluator, ConnectorPreview } from '../core/geometry/ConnectorPreview';
import type { RuntimeParameterRequest, RuntimeResult } from '../core/runtime/RuntimeTypes';

export interface VariablePanelHandle {
  setRuntimeResult(result: RuntimeResult, currentLine: number): void;
  selectVariable(name: string): void;
  selectedVariable(): string;
}

export interface VariableRow {
  name: string;
  type: string;
  value: string;
  changed: string;
}

export interface VariablePanelProps {
  onSelectionChanged?: (name: string) => void;
  ref?: Ref<VariablePanelHandle>;
}

export interface ParameterPanelHandle {
  setPlaceholderData(): void;
  setDefinitions(definitions: readonly RuntimeParameterRequest[]): void;
  updateRuntimeResult(result: RuntimeResult): void;
  values(): Map<string, string>;
}

export interface ParameterRow {
  key: string;
  line: number;
  texts: string[];
}

export interface ParameterEditor {
  row: number;
  text: string;
  serial: number;
}

export interface ParameterPanelProps {
  onChanged?: () => void;
  ref?: Ref<ParameterPanelHandle>;
}

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
  onSourceActivated?: (line: number) => void;
  onHistorySourceActivated?: (line: number) => void;
  ref?: Ref<ApiTracePanelHandle>;
}

export type PreviewChangedCallback = (
  previews: readonly ConnectorPreview[],
  selectedId: number,
  tested: boolean,
) => void;

export interface LinkPanelHandle {
  updateRuntimeResult(result: RuntimeResult): void;
  selectConnector(id: number): void;
  exitPreview(): void;
}

export interface LinkPanelProps {
  expressionEvaluator?: ConnectorExpressionEvaluator;
  onPreviewChanged?: PreviewChangedCallback;
  ref?: Ref<LinkPanelHandle>;
}

export interface LinkTableRow {
  id: number;
  texts: string[];
  buttonText: string;
}

export type SizeField = 'diameter' | 'aSize' | 'bSize';

export interface ScrollRequest {
  row: number;
  serial: number;
  center: boolean;
}

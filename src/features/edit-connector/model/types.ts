import type { Ref } from 'react';
import type { ConnectorExpressionEvaluator, ConnectorPreview } from '@engine/geometry';
import type { RuntimeResult } from '@engine/runtime';

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

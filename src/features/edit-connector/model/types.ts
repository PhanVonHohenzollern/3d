import type { LinkPanelModel } from '@/features/edit-connector/model/LinkPanelModel';
import type { RuntimeResult } from '@engine/runtime';

export interface LinkPanelHandle {
  updateRuntimeResult(result: RuntimeResult): void;
  selectConnector(id: number): void;
  exitPreview(): void;
}

export interface LinkPanelProps {
  model: LinkPanelModel;
}

export interface LinkTableRow {
  id: number;
  texts: string[];
  buttonText: string;
}

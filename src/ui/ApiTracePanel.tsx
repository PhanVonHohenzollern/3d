// Port of the widget part of ui/ApiTracePanel: a "Clear API Focus" tool
// button above the trace tree. All state and behavior live in
// ApiTracePanelModel (ApiTraceModel.ts); the ref handle is that model, so
// MainWindow calls it synchronously like the Qt widget.

import { useImperativeHandle, useLayoutEffect, useState, type Ref } from 'react';
import { ApiHistoryDialog } from './ApiHistoryDialog';
import type { ApiHistoryDialogModel } from './ApiHistoryModel';
import { ApiTracePanelModel, type ApiTracePanelHandle } from './ApiTraceModel';
import { useObservable } from './Observable';
import { TreeView } from './TreeView';
import './ApiTracePanel.css';

export type { ApiTracePanelHandle } from './ApiTraceModel';

export interface ApiTracePanelProps {
  /** setSelectionChangedCallback */
  onSelectionChanged?: (apiIndex: number) => void;
  /** setSourceActivatedCallback */
  onSourceActivated?: (line: number) => void;
  /** setHistorySourceActivatedCallback */
  onHistorySourceActivated?: (line: number) => void;
  ref?: Ref<ApiTracePanelHandle>;
}

const dialogKeys = new WeakMap<ApiHistoryDialogModel, number>();
let nextDialogKey = 1;
function dialogKey(dialog: ApiHistoryDialogModel): number {
  let key = dialogKeys.get(dialog);
  if (key === undefined) dialogKeys.set(dialog, (key = nextDialogKey++));
  return key;
}

export function ApiTracePanel({
  onSelectionChanged,
  onSourceActivated,
  onHistorySourceActivated,
  ref,
}: ApiTracePanelProps) {
  const [model] = useState(() => new ApiTracePanelModel());
  useObservable(model);

  useLayoutEffect(() => {
    model.setSelectionChangedCallback(onSelectionChanged ?? null);
    model.setSourceActivatedCallback(onSourceActivated ?? null);
    model.setHistorySourceActivatedCallback(onHistorySourceActivated ?? null);
  }, [model, onSelectionChanged, onSourceActivated, onHistorySourceActivated]);

  useImperativeHandle(ref, () => model, [model]);

  const dialog = model.historyDialog();
  return (
    <div className="api-trace-panel">
      <div className="api-trace-buttons">
        <button
          type="button"
          className="tool-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => model.clearFocusClicked()}
        >
          Clear API Focus
        </button>
      </div>
      <TreeView tree={model.m_tree} className="api-trace-tree" />
      {dialog && <ApiHistoryDialog key={dialogKey(dialog)} dialog={dialog} />}
    </div>
  );
}

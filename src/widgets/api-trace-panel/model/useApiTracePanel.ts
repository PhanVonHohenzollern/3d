import { useImperativeHandle, useLayoutEffect, useState } from 'react';
import type { ApiTracePanelProps } from '@/widgets/api-trace-panel/model/types';
import { ApiTracePanelModel } from '@/widgets/api-trace-panel/model/ApiTracePanelModel';
import { useObservable } from '@/shared/lib/observable';

export function useApiTracePanel({
  onSelectionChanged,
  onFunctionActivated,
  onSourceActivated,
  onHistorySourceActivated,
  ref,
}: ApiTracePanelProps) {
  const [model] = useState(() => new ApiTracePanelModel());
  useObservable(model);

  useLayoutEffect(() => {
    model.setSelectionChangedCallback(onSelectionChanged ?? null);
    model.setFunctionActivatedCallback(onFunctionActivated ?? null);
    model.setSourceActivatedCallback(onSourceActivated ?? null);
    model.setHistorySourceActivatedCallback(onHistorySourceActivated ?? null);
  }, [model, onSelectionChanged, onFunctionActivated, onSourceActivated, onHistorySourceActivated]);

  useImperativeHandle(ref, () => model, [model]);

  return { tree: model.m_tree, dialog: model.historyDialog(), clearFocus: () => model.clearFocusClicked() };
}

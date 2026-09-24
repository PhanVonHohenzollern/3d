import { useImperativeHandle, useLayoutEffect, useState } from 'react';
import type { ApiTracePanelProps } from '../types/panels';
import { ApiTracePanelModel } from './apiTrace/ApiTracePanelModel';
import { useObservable } from './useObservable';

export function useApiTracePanel({
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

  return { tree: model.m_tree, dialog: model.historyDialog(), clearFocus: () => model.clearFocusClicked() };
}

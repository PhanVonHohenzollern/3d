import type { ApiTracePanelProps } from '@/widgets/api-trace-panel/model/types';
import { useObservable } from '@/shared/lib/observable';

export function useApiTracePanel({ model }: ApiTracePanelProps) {
  useObservable(model);

  return { tree: model.m_tree, dialog: model.historyDialog(), clearFocus: () => model.clearFocusClicked() };
}

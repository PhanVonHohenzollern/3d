import { useMemo, type ReactNode } from 'react';
import {
  FunctionEditorContext,
  type FunctionEditorActions,
  type FunctionEditorContextValue,
  type FunctionEditorState,
} from '@/components/FunctionEditor/FunctionEditorContext';

type FunctionEditorProviderProps = {
  actions: FunctionEditorActions;
  children: ReactNode;
  state: FunctionEditorState;
};

const FunctionEditorProvider = ({ actions, children, state }: FunctionEditorProviderProps) => {
  const value = useMemo<FunctionEditorContextValue>(() => ({ actions, state }), [actions, state]);

  return <FunctionEditorContext value={value}>{children}</FunctionEditorContext>;
};

export { FunctionEditorProvider };

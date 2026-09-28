import { useMemo, type FC, type ReactNode } from 'react';
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

const FunctionEditorProvider: FC<FunctionEditorProviderProps> = ({ actions, children, state }) => {
  const value = useMemo<FunctionEditorContextValue>(() => ({ actions, state }), [actions, state]);

  return <FunctionEditorContext.Provider value={value}>{children}</FunctionEditorContext.Provider>;
};

export { FunctionEditorProvider };

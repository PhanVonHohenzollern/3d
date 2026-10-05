import { createContext, useContext } from 'react';

type FunctionEditorState = {
  active: string;
  error: string;
  names: readonly string[];
};

type FunctionEditorActions = {
  create: {
    add: (name: string, header: boolean) => boolean;
    clearError: () => void;
  };
  current: {
    remove: () => void;
  };
  select: (name: string) => void;
};

type FunctionEditorContextValue = {
  actions: FunctionEditorActions;
  state: FunctionEditorState;
};

const FunctionEditorContext = createContext<FunctionEditorContextValue | null>(null);

const useFunctionEditor = (): FunctionEditorContextValue => {
  const context = useContext(FunctionEditorContext);

  if (context === null) throw new Error('FunctionEditor.* must be used within <FunctionEditor.Provider>');

  return context;
};

export {
  FunctionEditorContext,
  useFunctionEditor,
  type FunctionEditorActions,
  type FunctionEditorContextValue,
  type FunctionEditorState,
};

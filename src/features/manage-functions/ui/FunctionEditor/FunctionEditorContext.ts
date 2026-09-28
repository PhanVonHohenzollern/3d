import { createContext, useContext } from 'react';

type FunctionEditorState = {
  active: string;
  error: string;
  names: readonly string[];
  unsaved: readonly string[];
};

type FunctionEditorActions = {
  create: {
    add: (name: string) => boolean;
    clearError: () => void;
  };
  current: {
    attach: () => void;
    cancel: () => void;
    remove: () => void;
    save: () => void;
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

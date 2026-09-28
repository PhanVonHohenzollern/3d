import { useFunctionEditor } from '@/components/FunctionEditor/FunctionEditorContext';

const FunctionEditorError = () => {
  const { state } = useFunctionEditor();

  if (!state.error) return null;

  return (
    <p role="alert" className="shrink-0 border-b border-line px-2 py-1 text-xs text-error">
      {state.error}
    </p>
  );
};

export { FunctionEditorError };

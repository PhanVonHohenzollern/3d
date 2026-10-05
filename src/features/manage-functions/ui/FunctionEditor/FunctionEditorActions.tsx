import { useFunctionEditor } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorContext';
import { Button } from '@/shared/ui/button';

const FunctionEditorActions = () => {
  const { actions, state } = useFunctionEditor();

  if (!state.active) return null;

  return (
    <div className="flex basis-full items-center gap-1">
      <Button
        size="xs"
        variant="outline"
        className="mr-auto text-error"
        title="Delete this source file"
        onClick={actions.current.remove}
      >
        Delete file
      </Button>
    </div>
  );
};

export { FunctionEditorActions };

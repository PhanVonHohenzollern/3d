import { useFunctionEditor } from '@/components/FunctionEditor/FunctionEditorContext';
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
        title="Delete this function, its tab and its definition in Main"
        onClick={actions.current.remove}
      >
        Delete
      </Button>
      <Button size="xs" variant="outline" onClick={actions.current.attach}>
        Attach
      </Button>
      <Button size="xs" variant="outline" onClick={actions.current.cancel}>
        Cancel
      </Button>
      <Button size="xs" onClick={actions.current.save}>
        Save
      </Button>
    </div>
  );
};

export { FunctionEditorActions };

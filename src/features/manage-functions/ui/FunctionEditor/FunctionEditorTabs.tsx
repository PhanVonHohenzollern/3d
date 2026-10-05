import { useCallback } from 'react';
import { useFunctionEditor } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorContext';
import { Button } from '@/shared/ui/button';
import { FunctionEditorAddDialog } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorAddDialog';

type FunctionEditorTabProps = {
  name: string;
};

const FunctionEditorTab = ({ name }: FunctionEditorTabProps) => {
  const { actions, state } = useFunctionEditor();
  const selected = state.active === name;

  const handleClick = useCallback(() => actions.select(name), [actions, name]);

  return (
    <Button
      role="tab"
      aria-selected={selected}
      size="xs"
      variant={selected ? 'secondary' : 'ghost'}
      onClick={handleClick}
    >
      {name || 'Main.cpp'}
    </Button>
  );
};

const FunctionEditorTabs = () => {
  const { state } = useFunctionEditor();

  return (
    <div
      role="tablist"
      aria-label="Source files"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-2 py-1"
    >
      {['', ...state.names].map((name) => (
        <FunctionEditorTab key={name} name={name} />
      ))}
      <FunctionEditorAddDialog />
    </div>
  );
};

export { FunctionEditorTabs };

import { useCallback, type FC } from 'react';
import { useFunctionEditor } from '@/components/FunctionEditor/FunctionEditorContext';
import { Button } from '@/components/ui/button';

type FunctionEditorTabProps = {
  name: string;
};

const FunctionEditorTab: FC<FunctionEditorTabProps> = ({ name }) => {
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
      {name || 'Main'}
      {state.unsaved.includes(name) ? ' *' : ''}
    </Button>
  );
};

const FunctionEditorTabs: FC = () => {
  const { state } = useFunctionEditor();

  if (state.names.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Code functions"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-2 py-1"
    >
      {['', ...state.names].map((name) => (
        <FunctionEditorTab key={name} name={name} />
      ))}
    </div>
  );
};

export { FunctionEditorTabs };

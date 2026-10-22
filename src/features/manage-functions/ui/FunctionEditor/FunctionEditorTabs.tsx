import { useCallback } from 'react';
import { AlertDialog } from 'radix-ui';
import { X } from 'lucide-react';
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
    <div role="presentation" className={`group/tab relative flex shrink-0 items-center ${name ? 'pt-4 pr-4' : ''}`}>
      <Button
        role="tab"
        aria-selected={selected}
        size="xs"
        variant={selected ? 'secondary' : 'ghost'}
        onClick={handleClick}
      >
        {name || 'Main.cpp'}
      </Button>
      {name && (
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="pointer-events-none absolute top-0 right-0 size-[15.4px] rounded-full text-muted-foreground opacity-0 transition-colors group-hover/tab:pointer-events-auto group-hover/tab:opacity-100 hover:bg-red-500/20 hover:text-red-500 focus-visible:pointer-events-auto focus-visible:bg-red-500/20 focus-visible:text-red-500 focus-visible:opacity-100 dark:hover:bg-red-500/20"
              aria-label={`Delete ${name}`}
              title={`Delete ${name}`}
            >
              <X className="size-[11px]" aria-hidden="true" />
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <AlertDialog.Content
              data-floating-window
              className="fixed top-1/2 left-1/2 z-50 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-base p-4 text-foreground shadow-xl"
            >
              <AlertDialog.Title className="text-sm font-semibold">Do you want to delete this tab?</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                {name} code will be removed from the editor.
              </AlertDialog.Description>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialog.Cancel asChild>
                  <Button size="sm" variant="outline">
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button size="sm" variant="destructive" onClick={() => actions.current.remove(name)}>
                    Delete
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )}
    </div>
  );
};

const FunctionEditorTabs = () => {
  const { state } = useFunctionEditor();

  return (
    <div
      role="tablist"
      aria-label="Source files"
      className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-line px-2 py-1"
    >
      {['', ...state.names].map((name) => (
        <FunctionEditorTab key={name} name={name} />
      ))}
      <FunctionEditorAddDialog />
    </div>
  );
};

export { FunctionEditorTabs };

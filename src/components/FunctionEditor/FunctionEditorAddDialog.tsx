import { useCallback, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import { Dialog } from 'radix-ui';
import { useFunctionEditor } from '@/components/FunctionEditor/FunctionEditorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FunctionEditorAddDialog: FC = () => {
  const { actions, state } = useFunctionEditor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const { add, clearError } = actions.create;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setOpen(value);
      setName('');
      clearError();
    },
    [clearError],
  );

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setName(event.target.value), []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (add(name)) setOpen(false);
    },
    [add, name],
  );

  if (state.active) return null;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button size="xs" variant="outline">
          Add Function
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          data-floating-window
          className="fixed top-1/2 left-1/2 z-50 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-base p-4 text-foreground shadow-xl"
        >
          <Dialog.Title className="text-sm font-semibold">Add Function</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Enter a unique tab name. The C++ function name is defined in its code.
          </Dialog.Description>
          <form onSubmit={handleSubmit}>
            <label className="mt-3 block text-xs">
              Tab name
              <Input className="mt-1" value={name} onChange={handleNameChange} aria-invalid={!!state.error} />
            </label>
            {state.error && (
              <p role="alert" className="mt-2 text-xs text-error">
                {state.error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" size="sm" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm">
                Add
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export { FunctionEditorAddDialog };

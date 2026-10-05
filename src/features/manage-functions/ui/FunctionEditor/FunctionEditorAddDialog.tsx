import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { Dialog } from 'radix-ui';
import { useFunctionEditor } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';

const FunctionEditorAddDialog = () => {
  const { actions, state } = useFunctionEditor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [header, setHeader] = useState(true);
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
      if (add(name, header)) setOpen(false);
    },
    [add, name, header],
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button size="xs" variant="outline" aria-label="Add source files" title="Add .h and .cpp files">
          +
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          data-floating-window
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-base p-4 text-foreground shadow-xl"
        >
          <Dialog.Title className="text-sm font-semibold">Add source files</Dialog.Title>
          <form onSubmit={handleSubmit}>
            <label className="mt-3 block text-xs">
              File name
              <Input className="mt-1" value={name} onChange={handleNameChange} aria-invalid={!!state.error} />
            </label>
            <label className="mt-3 block text-xs">
              Create
              <NativeSelect
                value={header ? 'pair' : 'cpp'}
                onChange={(event) => setHeader(event.target.value === 'pair')}
              >
                <option value="pair">.h + .cpp</option>
                <option value="cpp">.cpp</option>
              </NativeSelect>
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

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';

export interface FunctionEditorToolsProps {
  active: string;
  names: string[];
  unsaved: string[];
  error: string;
  add: (name: string) => boolean;
  select: (name: string) => void;
  save: () => void;
  cancel: () => void;
  attach: () => void;
  remove: () => void;
}

export function FunctionEditorTabs(props: FunctionEditorToolsProps) {
  return (
    <>
      {props.names.length > 0 && (
        <div
          role="tablist"
          aria-label="Code functions"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-2 py-1"
        >
          {['', ...props.names].map((name) => (
            <Button
              key={name}
              role="tab"
              aria-selected={props.active === name}
              size="xs"
              variant={props.active === name ? 'secondary' : 'ghost'}
              onClick={() => props.select(name)}
            >
              {name || 'Main'}
              {props.unsaved.includes(name) ? ' *' : ''}
            </Button>
          ))}
        </div>
      )}
      {props.error && (
        <p role="alert" className="shrink-0 border-b border-line px-2 py-1 text-xs text-error">
          {props.error}
        </p>
      )}
    </>
  );
}

export function FunctionEditorFooter(props: FunctionEditorToolsProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  if (props.active)
    return (
      <div className="ml-auto flex gap-1">
        <Button size="xs" variant="outline" className="text-error" onClick={props.remove}>
          Delete
        </Button>
        <Button size="xs" variant="outline" onClick={props.attach}>
          Attach
        </Button>
        <Button size="xs" variant="outline" onClick={props.cancel}>
          Cancel
        </Button>
        <Button size="xs" onClick={props.save}>
          Save
        </Button>
      </div>
    );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setName('');
        setError('');
      }}
    >
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
            Enter a unique C++ function name.
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (props.add(name)) setOpen(false);
              else setError('Enter a valid, unique function name.');
            }}
          >
            <label className="mt-3 block text-xs">
              Function name
              <Input
                className="mt-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={!!error}
              />
            </label>
            {error && (
              <p role="alert" className="mt-2 text-xs text-error">
                {props.error || error}
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
}

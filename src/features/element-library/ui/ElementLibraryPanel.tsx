import { useState } from 'react';
import { Library } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/native-select';
import { Input } from '@/shared/ui/input';
import { FloatingWindow } from '@/shared/ui/floating-window';
import { useObservable } from '@/shared/lib/observable';
import type { ElementLibraryModel } from '@/features/element-library/model/ElementLibraryModel';

export function ElementLibraryPanel({ model }: { model: ElementLibraryModel }) {
  useObservable(model);
  const [open, setOpen] = useState(false);
  const [raiseSerial, setRaiseSerial] = useState(0);
  const [search, setSearch] = useState('');
  const elements = model.elements.filter((element) =>
    `${element.name} ${element.symbol}`.toLowerCase().includes(search.toLowerCase()),
  );

  function showLibrary() {
    setOpen(true);
    setRaiseSerial((serial) => serial + 1);
    if (!model.libraryName && model.assets.length) void model.selectLibrary(model.assets[0].name);
  }

  return (
    <>
      <Button variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={showLibrary}>
        <Library className="size-4" aria-hidden /> FLM
      </Button>
      {open && (
        <FloatingWindow title="FLM Elements" raiseSerial={raiseSerial} onClose={() => setOpen(false)}>
          <div className="flex shrink-0 flex-wrap gap-2 p-1">
            <label className="min-w-32 flex-1 space-y-1">
              <span className="block text-xs">Library</span>
              <NativeSelect
                aria-label="Library"
                className="w-full"
                value={model.libraryName}
                onChange={(event) => {
                  setSearch('');
                  void model.selectLibrary(event.target.value);
                }}
              >
                {model.assets.map((asset) => (
                  <option key={asset.name} value={asset.name}>
                    {asset.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="min-w-40 flex-1 space-y-1">
              <span className="block text-xs">Search</span>
              <Input
                aria-label="Search elements"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or symbol"
                className="h-9"
              />
            </label>
          </div>
          <ul aria-label="Elements" className="min-h-20 flex-1 overflow-y-auto rounded-md border border-line">
            {elements.map((element) => (
              <li key={element.id}>
                <button
                  type="button"
                  aria-pressed={model.elementId === element.id}
                  onClick={() => model.openElement(element.id)}
                  className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left text-xs last:border-b-0 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-secondary"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{element.symbol}</span>
                    <span className="block text-muted-foreground">{element.name}</span>
                  </span>
                  {element.error && <span className="shrink-0 text-muted-foreground">Unavailable</span>}
                </button>
              </li>
            ))}
            {!elements.length && (
              <li role="status" className="px-3 py-4 text-xs text-muted-foreground">
                {model.busy ? 'Loading elements…' : 'No matching elements.'}
              </li>
            )}
          </ul>
          {model.element && (
            <div className="max-h-48 shrink-0 overflow-y-auto p-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{model.element.name}</span>
                <Button size="xs" variant="outline" onClick={model.reset} disabled={!model.canOpen}>
                  Reset values
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {model.resolution.choices.map((choice) => (
                  <label key={choice.name} className="min-w-32 flex-1 space-y-1">
                    <span className="block text-xs">{choice.label}</span>
                    <NativeSelect
                      aria-label={choice.name}
                      className="w-full"
                      value={model.resolution.values.get(choice.name) ?? ''}
                      onChange={(event) => model.selectValue(choice.name, event.target.value)}
                    >
                      {choice.values.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                ))}
              </div>
            </div>
          )}
          {(model.error || model.resolution.errors.length > 0) && (
            <p role="alert" className="text-xs text-error">
              {model.error || model.resolution.errors.join(' ')}
            </p>
          )}
          {model.notice && (
            <p role="status" className="text-xs text-muted-foreground">
              {model.notice}
            </p>
          )}
          <div className="flex shrink-0 justify-end p-1">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </FloatingWindow>
      )}
    </>
  );
}

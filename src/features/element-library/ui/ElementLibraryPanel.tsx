import { useState } from 'react';
import { ChevronDown, ChevronRight, Library } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { FloatingWindow } from '@/shared/ui/floating-window';
import { useObservable } from '@/shared/lib/observable';
import type { ElementLibraryModel } from '@/features/element-library/model/ElementLibraryModel';

export function ElementLibraryPanel({ model }: { model: ElementLibraryModel }) {
  useObservable(model);
  const [open, setOpen] = useState(false);
  const [raiseSerial, setRaiseSerial] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expanded, setExpanded] = useState(() => new Set([model.assets[0]?.name]));
  const asset = model.assets.find((asset) => asset.name === model.libraryName);
  const category = asset?.catalog.categories.find((category) => category.id === categoryId);
  const elements = model.filteredElements(categoryId, search);

  function showLibrary() {
    setOpen(true);
    setRaiseSerial((serial) => serial + 1);
    if (!model.libraryName && model.assets.length) void model.selectLibrary(model.assets[0].name);
  }

  function selectCategory(library: string, id = '') {
    setCategoryId(id);
    setSearch('');
    setExpanded((current) => new Set([...current, library]));
    if (model.libraryName !== library) void model.selectLibrary(library);
  }

  return (
    <>
      <Button variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={showLibrary}>
        <Library className="size-4" aria-hidden /> FLM
      </Button>
      {open && (
        <FloatingWindow title="FLM Elements" raiseSerial={raiseSerial} onClose={() => setOpen(false)}>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(140px,22%)_minmax(0,1fr)] overflow-hidden rounded-md border border-line">
            <nav aria-label="Element categories" className="overflow-y-auto border-r border-line p-2">
              <ul className="space-y-2">
                {model.assets.map((library) => (
                  <li key={library.name}>
                    <div className="flex items-start">
                      <button
                        type="button"
                        aria-label={`${expanded.has(library.name) ? 'Collapse' : 'Expand'} ${library.catalog.label}`}
                        aria-expanded={expanded.has(library.name)}
                        onClick={() =>
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(library.name)) next.delete(library.name);
                            else next.add(library.name);

                            return next;
                          })
                        }
                        className="shrink-0 rounded p-1.5 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {expanded.has(library.name) ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-current={model.libraryName === library.name && !categoryId ? 'page' : undefined}
                        onClick={() => selectCategory(library.name)}
                        className="min-w-0 flex-1 rounded px-1 py-1.5 text-left text-xs font-medium hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary"
                      >
                        {library.catalog.label}
                      </button>
                    </div>
                    {expanded.has(library.name) && (
                      <ul className="ml-3 border-l border-line pl-2">
                        {library.catalog.categories.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              aria-current={
                                model.libraryName === library.name && categoryId === item.id ? 'page' : undefined
                              }
                              onClick={() => selectCategory(library.name, item.id)}
                              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary"
                            >
                              <span className="min-w-0 flex-1">{item.name}</span>
                              <span className="text-muted-foreground">{item.elements.length}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex min-h-0 flex-col">
              <div className="shrink-0 space-y-2 border-b border-line p-3">
                <Input
                  aria-label="Search elements"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search this library by name or symbol"
                  className="h-9"
                />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">
                    {search.trim() ? 'Search results' : (category?.name ?? asset?.catalog.label)}
                  </span>
                  <span className="shrink-0 text-muted-foreground" role="status">
                    {model.busy ? 'Loading…' : `${elements.length} elements`}
                  </span>
                </div>
              </div>
              <ul
                aria-label="Elements"
                className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 overflow-y-auto p-3"
              >
                {elements.map((element) => {
                  const item = asset?.catalog.items[element.id];
                  const symbol = item?.symbol ?? element.symbol;

                  return (
                    <li key={element.id}>
                      <button
                        type="button"
                        aria-label={`${symbol}: ${element.name}`}
                        aria-pressed={model.elementId === element.id}
                        title={`${symbol} — ${element.name}`}
                        onClick={() => {
                          model.openElement(element.id);
                          if (model.canOpen) setOpen(false);
                        }}
                        className="flex h-full w-full flex-col items-center rounded-md border border-transparent p-2 text-center text-xs hover:border-line hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:border-ring aria-pressed:bg-secondary"
                      >
                        {item && (
                          <img
                            src={`${import.meta.env.BASE_URL}library-icons/${model.libraryName}/${item.thumbnail}`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={160}
                            height={112}
                            className="h-24 w-full object-contain"
                          />
                        )}
                        <span className="mt-1 w-full text-center font-medium wrap-anywhere">{symbol}</span>
                        <span className="mt-1 w-full text-center wrap-anywhere text-muted-foreground">
                          {element.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!model.busy && !elements.length && (
                  <li className="col-span-full p-4 text-center text-xs text-muted-foreground">No matching elements.</li>
                )}
              </ul>
            </div>
          </div>
          {(model.error || model.resolution.errors.length > 0) && (
            <p role="alert" className="text-xs text-error">
              {model.error || model.resolution.errors.join(' ')}
            </p>
          )}
          <div className="flex shrink-0 items-center justify-between gap-2 p-1">
            <span className="text-xs text-muted-foreground">Open an element to edit its values in Parameters.</span>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </FloatingWindow>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ImageOff } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useObservable } from '@/shared/lib/observable';
import type { ElementLibraryModel } from '@/features/element-library/model/ElementLibraryModel';

/** A missing slide or a failed SVG request must never look like a blank card. */
function ElementThumbnail({
  library,
  filename,
  geometryError,
}: {
  library: string;
  filename?: string;
  geometryError?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!filename || failed) {
    const description = geometryError ? 'No geometry source' : 'No thumbnail';

    return (
      <div
        className="flex h-20 w-full flex-col items-center justify-center gap-1 text-muted-foreground"
        role="img"
        aria-label={description}
        title={geometryError ?? (filename ? 'SVG could not be loaded' : 'No slide in library metadata')}
      >
        <ImageOff className="size-5" aria-hidden />
        <span className="text-[10px]">{description}</span>
      </div>
    );
  }

  const path = [library, ...filename.split('/')].map(encodeURIComponent).join('/');

  return (
    <img
      src={`${import.meta.env.BASE_URL}library-icons/${path}`}
      alt=""
      loading="lazy"
      decoding="async"
      width={160}
      height={112}
      className="h-20 w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/** A full-size editor tab: selecting previews, OK is the only code commit. */
export function ElementLibraryPanel({ model, active }: { model: ElementLibraryModel; active: boolean }) {
  useObservable(model);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expanded, setExpanded] = useState(() => new Set([model.assets[0]?.name]));
  const asset = model.assets.find((item) => item.name === model.libraryName);
  const category = asset?.catalog.categories.find((item) => item.id === categoryId);
  const elements = model.filteredElements(categoryId, search);

  useEffect(() => {
    if (active && !model.libraryName && model.assets.length) void model.selectLibrary(model.assets[0].name);
  }, [active, model]);

  function selectCategory(library: string, id = '') {
    setCategoryId(id);
    setSearch('');
    setExpanded((current) => new Set([...current, library]));
    if (model.libraryName !== library) void model.selectLibrary(library);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-base">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(110px,38%)_minmax(0,1fr)] overflow-hidden">
        <nav aria-label="Element categories" className="min-w-0 overflow-y-auto border-r border-line p-1.5">
          <ul className="space-y-1.5">
            {model.assets.map((library) => (
              <li key={library.name}>
                <div className="flex min-w-0 items-start">
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
                    className="shrink-0 rounded p-1 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {expanded.has(library.name) ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-current={model.libraryName === library.name && !categoryId ? 'page' : undefined}
                    onClick={() => selectCategory(library.name)}
                    className="min-w-0 flex-1 rounded px-1 py-1 text-left text-xs font-medium wrap-anywhere hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary"
                  >
                    {library.catalog.label}
                  </button>
                </div>
                {expanded.has(library.name) && (
                  <ul className="ml-2 border-l border-line pl-1">
                    {library.catalog.categories.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={
                            model.libraryName === library.name && categoryId === item.id ? 'page' : undefined
                          }
                          onClick={() => selectCategory(library.name, item.id)}
                          className="flex w-full min-w-0 items-start justify-between gap-1 rounded px-1 py-1 text-left text-xs hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary"
                        >
                          <span className="min-w-0 wrap-anywhere">{item.name}</span>
                          <span className="shrink-0 text-muted-foreground">{item.elements.length}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 space-y-2 border-b border-line p-2">
            <Input
              aria-label="Search elements"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search elements"
              className="h-8"
            />
            <div className="flex items-center justify-between gap-1 text-xs">
              <span className="min-w-0 truncate font-medium">
                {search.trim() ? 'Search results' : (category?.name ?? asset?.catalog.label ?? 'Library')}
              </span>
              <span className="shrink-0 text-muted-foreground" role="status">
                {model.busy ? 'Loading…' : elements.length}
              </span>
            </div>
          </div>
          <ul
            aria-label="Elements"
            className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(125px,1fr))] gap-1.5 overflow-y-auto p-2"
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
                    title={element.error ?? `${symbol} — ${element.name}`}
                    onClick={() => model.selectElement(element.id)}
                    className="flex h-full w-full min-w-0 flex-col items-center rounded-md border border-transparent p-1.5 text-center text-xs hover:border-line hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:border-ring aria-pressed:bg-secondary"
                  >
                    <ElementThumbnail
                      key={`${model.libraryName}/${item?.thumbnail ?? ''}`}
                      library={model.libraryName}
                      filename={item?.thumbnail}
                      geometryError={element.error}
                    />
                    <span className="mt-1 w-full font-medium wrap-anywhere">{symbol}</span>
                    <span className="mt-1 w-full wrap-anywhere text-muted-foreground">{element.name}</span>
                  </button>
                </li>
              );
            })}
            {!model.busy && !elements.length && (
              <li className="col-span-full p-3 text-center text-xs text-muted-foreground">No matching elements.</li>
            )}
          </ul>
        </div>
      </div>
      {(model.error || model.resolution.errors.length > 0) && (
        <p role="alert" className="max-h-24 shrink-0 overflow-y-auto border-t border-line px-2 py-1 text-xs text-error">
          {model.error || model.resolution.errors.join(' ')}
        </p>
      )}
      {!!model.resolution.missingInputs?.length && (
        <p role="status" className="shrink-0 border-t border-line px-2 py-1 text-xs text-muted-foreground">
          Enter dimensions in Parameters: {model.resolution.missingInputs.join(', ')}
        </p>
      )}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-2 py-2">
        <span className="min-w-0 text-xs text-muted-foreground">
          {model.element ? `${model.element.symbol} · preview only` : 'Select an element to preview'}
        </span>
        <Button size="sm" disabled={!model.canOpen} onClick={model.open}>
          OK
        </Button>
      </div>
    </div>
  );
}

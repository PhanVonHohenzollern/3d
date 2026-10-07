import type { LibraryElement } from '@/features/element-library/model/types';

export interface LibraryPresetRow {
  elementId: string;
  variantIndex: number;
  values: ReadonlyMap<string, string>;
  connectors: LibraryElement['connectors'];
}

// Elements sharing an entry point select different branches of the same C++ function.
// Keep each complete record, including its connector definitions, when switching branches.
export function libraryPresetTable(elements: readonly LibraryElement[], selected: LibraryElement) {
  const family = elements.filter((element) => element.entry === selected.entry && !element.error);
  const selectors = [...new Set(family.flatMap((element) => element.selectors.map((selector) => selector.name)))];
  if (family.some((element) => element.defaults.elType !== undefined)) selectors.unshift('elType');
  const rows: LibraryPresetRow[] = family.flatMap((element) =>
    element.variants.map((variant, variantIndex) => ({
      elementId: element.id,
      variantIndex,
      values: new Map(Object.entries({ ...element.defaults, ...variant.selection, ...variant.defaults })),
      connectors: variant.connectors ?? element.connectors,
    })),
  );

  return { selectors: [...new Set(selectors)], rows };
}

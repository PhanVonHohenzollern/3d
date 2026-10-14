import type { ConnectorDefinition } from '@engine/geometry';

export interface LibraryAsset {
  name: string;
  catalog: LibraryCatalog;
  load: () => Promise<ElementLibrary>;
  sources: { name: string; path: string }[];
}

export interface LibraryCatalog {
  label: string;
  categories: { id: string; name: string; elements: string[] }[];
  items: Record<string, { symbol: string; thumbnail: string }>;
}

export interface LibrarySelector {
  name: string;
  label: string;
}

export interface LibraryVariant {
  selection: Record<string, string>;
  defaults: Record<string, string>;
  connectors?: ConnectorDefinition[];
}

export interface LibraryElement {
  id: string;
  name: string;
  symbol: string;
  entry: string;
  defaults: Record<string, string>;
  selectors: LibrarySelector[];
  // XML selectors passed through helper functions may not appear in a C++ switch.
  controls?: string[];
  variants: LibraryVariant[];
  connectors: ConnectorDefinition[];
  error?: string;
  resolve?: (values?: ReadonlyMap<string, string>, changed?: readonly string[]) => LibraryValues;
}

export interface LibraryValues {
  values: Map<string, string>;
  connectors: ConnectorDefinition[];
  options: Map<string, string[]>;
}

export interface ElementLibrary {
  name: string;
  elements: LibraryElement[];
}

export interface LibraryResolution {
  values: Map<string, string>;
  choices: { name: string; label: string; values: string[] }[];
  errors: string[];
}

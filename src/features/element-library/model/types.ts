import type { ConnectorDefinition } from '@engine/geometry';

export interface LibraryAsset {
  name: string;
  presets: string;
  sources: { name: string; path: string }[];
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
  variants: LibraryVariant[];
  connectors: ConnectorDefinition[];
  error?: string;
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

import type { ConnectorDefinition } from '@engine/geometry';
import type { ResolvedSnapshot } from '@/features/element-library/model/constraintGraph';

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
  // Display metadata only: hidden variables still participate in resolution and geometry.
  hiddenParameters?: readonly string[];
  // XML selectors passed through helper functions may not appear in a C++ switch.
  controls?: string[];
  variants: LibraryVariant[];
  connectors: ConnectorDefinition[];
  error?: string;
  requireParameters?: (names: readonly string[]) => void;
  resolve: (values?: ReadonlyMap<string, string>, changed?: readonly string[]) => LibraryValues;
}

export interface LibraryValues {
  values: Map<string, string>;
  connectors: ConnectorDefinition[];
  options: Map<string, string[]>;
  errors?: string[];
  // Preview/link issues must not be mistaken for invalid geometry graph values.
  connectorDiagnostics?: string[];
  // C++ requests absent from the entity schema may belong to other runtime
  // branches; verify their actual execution rather than blocking on discovery.
  parameterDiagnostics?: string[];
  snapshot: ResolvedSnapshot;
}

export interface ElementLibrary {
  name: string;
  elements: LibraryElement[];
}

export interface LibraryResolution {
  values: Map<string, string>;
  // TYPE=1 LEVEL>0: suggestions in choices are not a closed input domain.
  nonrestrictiveParameters?: ReadonlySet<string>;
  choices: { name: string; label: string; values: string[] }[];
  errors: string[];
  connectorDiagnostics?: string[];
  parameterDiagnostics?: string[];
}

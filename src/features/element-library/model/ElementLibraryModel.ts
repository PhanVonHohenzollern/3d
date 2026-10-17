import { FunctionWorkspace } from '@/entities/source-function';
import { Observable, Signal } from '@/shared/lib/observable';
import { GeometryRuntime, type RuntimeParameterRequest } from '@engine/runtime';
import { libraries } from '@/features/element-library/config/libraries';
import { LibraryDefaults, type LibraryDefaultState } from '@/features/element-library/model/LibraryDefaults';
import {
  decodeLibraryAsset,
  prepareElementSource,
  type LibrarySource,
} from '@/features/element-library/model/sourceLibrary';
import type {
  ElementLibrary,
  LibraryElement,
  LibraryResolution,
  LibraryVariant,
  LibraryValues,
} from '@/features/element-library/model/types';

export interface LibrarySample {
  id: string;
  files: LibrarySource[];
  values: ReadonlyMap<string, string>;
  connectors: LibraryElement['connectors'];
  defaults?: LibraryDefaults;
}

export class ElementLibraryModel extends Observable {
  readonly assets = libraries;
  readonly openRequested = new Signal<[sample: LibrarySample, replaceSource: boolean]>();
  libraryName = '';
  elementId = '';
  elements: LibraryElement[] = [];
  busy = false;
  error = '';
  resolution: LibraryResolution = { values: new Map(), choices: [], errors: [] };
  readonly #cache = new Map<string, { library: ElementLibrary; sources: LibrarySource[] }>();
  #sources: LibrarySource[] = [];
  #files: LibrarySource[] = [];
  #variant: LibraryVariant | undefined;
  #resolved: LibraryValues | undefined;
  #parameters: RuntimeParameterRequest[] = [];
  #opened = '';
  #sequence = 0;

  get element(): LibraryElement | undefined {
    return this.elements.find((element) => element.id === this.elementId);
  }

  get canOpen(): boolean {
    return !!this.element && !!this.#files.length && !this.busy && !this.error && !this.resolution.errors.length;
  }

  filteredElements(categoryId: string, search: string): LibraryElement[] {
    const catalog = this.assets.find((asset) => asset.name === this.libraryName)?.catalog;
    const category = catalog?.categories.find((category) => category.id === categoryId);
    const query = search.trim().toLowerCase();
    const elements =
      !query && category
        ? category.elements.flatMap((id) => this.elements.find((element) => element.id === id) ?? [])
        : this.elements;

    return elements.filter((element) =>
      `${catalog?.items[element.id]?.symbol ?? ''} ${element.symbol} ${element.name} ${element.entry}`
        .toLowerCase()
        .includes(query),
    );
  }

  readonly selectLibrary = async (name: string): Promise<void> => {
    const sequence = ++this.#sequence;
    this.libraryName = name;
    this.elementId = '';
    this.elements = [];
    this.#files = [];
    this.#variant = undefined;
    this.#resolved = undefined;
    this.#opened = '';
    this.#parameters = [];
    this.error = '';
    this.resolution = { values: new Map(), choices: [], errors: [] };
    this.busy = true;
    this.changed();
    try {
      const asset = this.assets.find((item) => item.name === name);
      if (!asset) throw new Error('Library not found');
      let cached = this.#cache.get(name);
      if (!cached) {
        const read = async (path: string): Promise<string> => {
          const response = await fetch(import.meta.env.BASE_URL + path.split('/').map(encodeURIComponent).join('/'));
          if (!response.ok) throw new Error(`Unable to load ${name}: HTTP ${response.status}`);

          return decodeLibraryAsset(new Uint8Array(await response.arrayBuffer()));
        };

        const [library, ...codes] = await Promise.all([
          asset.load(),
          ...asset.sources.map((source) => read(source.path)),
        ]);
        cached = {
          library,
          sources: asset.sources.map((source, index) => ({ name: source.name, code: codes[index] })),
        };
        this.#cache.set(name, cached);
      }
      if (sequence !== this.#sequence) return;
      this.#sources = cached.sources;
      this.elements = cached.library.elements;
      if (!this.elements.length) this.error = 'No geometry elements in this library.';
    } catch (error) {
      if (sequence === this.#sequence) this.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (sequence === this.#sequence) {
        this.busy = false;
        this.changed();
      }
    }
  };

  readonly selectElement = (id: string): void => {
    this.elementId = id;
    this.#files = [];
    this.#variant = undefined;
    this.#resolved = undefined;
    this.error = '';
    this.resolution = { values: new Map(), choices: [], errors: [] };
    try {
      const element = this.element;
      if (!element) return;
      if (element.error) throw new Error(element.error);
      this.#files = prepareElementSource(this.#sources, element.entry);
      const workspace = new FunctionWorkspace();
      workspace.replaceFiles(this.#files);
      const program = workspace.program();
      this.#parameters = new GeometryRuntime().discoverParameters(program.source, program.options);
      for (const candidate of this.elements.filter((candidate) => candidate.entry === element.entry))
        candidate.requireParameters?.(
          this.#parameters
            .filter((parameter) => parameter.sourceFunction === 'get_val')
            .map((parameter) => parameter.name),
        );
      this.#resolve();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.changed();
  };

  readonly openElement = (id: string): void => {
    this.selectElement(id);
    this.open();
  };

  #resolve(selection = new Map<string, string>(), changed?: string): void {
    const element = this.element;
    if (!element) return;
    const resolved = element.resolve(selection.size ? selection : undefined, changed ? [changed] : []);
    this.#resolved = resolved;
    this.#variant = { selection: {}, defaults: Object.fromEntries(resolved.values), connectors: resolved.connectors };
    this.resolution = {
      values: resolved.values,
      nonrestrictiveParameters: resolved.snapshot.nonrestrictiveParameters,
      choices: element.selectors.map((s) => ({ ...s, values: resolved.options.get(s.name) ?? [] })),
      errors: resolved.snapshot.status === 'valid' ? [] : resolved.errors?.length ? resolved.errors : [`Configuration is ${resolved.snapshot.status}`],
      connectorDiagnostics: resolved.connectorDiagnostics,
      parameterDiagnostics: resolved.parameterDiagnostics,
    };
  }

  syncDefaults(state: LibraryDefaultState): void {
    if (state.snapshot.status !== 'valid') throw new Error('Invalid library snapshot');
    if (!this.elements.some((element) => element.id === state.elementId)) return;
    this.elementId = state.elementId;
    this.#opened = state.elementId;
    this.resolution = {
      values: new Map(state.values),
      nonrestrictiveParameters: state.snapshot.nonrestrictiveParameters,
      choices: this.element!.selectors.map((selector) => ({ ...selector, values: state.options?.get(selector.name) ?? [] })),
      errors: [],
    };
    this.#variant = { selection: {}, defaults: Object.fromEntries(state.values), connectors: state.connectors };
    this.#resolved = { values: new Map(state.values), connectors: state.connectors, options: new Map(state.options), snapshot: state.snapshot };
    this.changed();
  }

  readonly selectValue = (name: string, value: string): void => {
    const selection = new Map(this.resolution.values);
    selection.set(name, value);
    this.#resolve(selection, name);
    this.changed();
    if (this.#opened === this.elementId && this.canOpen) this.#publish(false);
  };

  readonly reset = (): void => {
    this.#resolve();
    this.changed();
    if (this.#opened === this.elementId && this.canOpen) this.#publish(false);
  };

  readonly open = (): void => {
    if (!this.canOpen) return;
    this.#opened = this.elementId;
    this.#publish(true);
  };

  #publish(replaceSource: boolean): void {
    const element = this.element;
    if (!element || !this.canOpen || this.#resolved?.snapshot.status !== 'valid') return;
    const connectors = this.#variant?.connectors ?? element.connectors;
    this.openRequested.emit(
      {
        id: this.elementId,
        files: this.#files,
        values: this.resolution.values,
        connectors,
        defaults: new LibraryDefaults(
          this.elements.filter((candidate) => candidate.entry === element.entry && !candidate.error),
          this.#parameters,
          {
            elementId: element.id,
            values: this.resolution.values,
            connectors,
            options: this.#resolved!.options,
            snapshot: this.#resolved!.snapshot,
          },
        ),
      },
      replaceSource,
    );
  }
}

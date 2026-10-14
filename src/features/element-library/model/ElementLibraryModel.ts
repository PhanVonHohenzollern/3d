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
  #parameters: RuntimeParameterRequest[] = [];
  #opened = '';
  #sequence = 0;

  get element(): LibraryElement | undefined {
    return this.elements.find((element) => element.id === this.elementId);
  }

  get canOpen(): boolean {
    return !!this.element && !!this.#files.length && !this.busy && !this.error && !this.resolution.errors.length;
  }

  readonly selectLibrary = async (name: string): Promise<void> => {
    const sequence = ++this.#sequence;
    this.libraryName = name;
    this.elementId = '';
    this.elements = [];
    this.#files = [];
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
    if (element.resolve) {
      const resolved = element.resolve(selection.size ? selection : undefined, changed ? [changed] : []);
      this.#variant = { selection: {}, defaults: Object.fromEntries(resolved.values), connectors: resolved.connectors };
      this.resolution = { values: resolved.values, choices: this.#choices(resolved.values), errors: [] };

      return;
    }

    const matches = (variant: LibraryVariant) =>
      [...selection].filter(([name, value]) => variant.selection[name] === value).length;

    this.#variant = element.variants
      .filter((variant) => !changed || variant.selection[changed] === selection.get(changed))
      .sort((a, b) => matches(b) - matches(a))[0];
    const values = new Map(
      Object.entries({ ...element.defaults, ...this.#variant?.selection, ...this.#variant?.defaults }),
    );
    this.resolution = {
      values,
      choices: this.#choices(values),
      errors: this.#variant ? [] : ['No preset for this size/variant.'],
    };
  }

  #choices(values: ReadonlyMap<string, string>): LibraryResolution['choices'] {
    const element = this.element;
    if (!element) return [];
    if (element.resolve) {
      const options = element.resolve(values).options;

      return element.selectors.map((selector) => ({ ...selector, values: options.get(selector.name) ?? [] }));
    }
    // Discrete choices determine the available sizes. A size must not hide the
    // other technologies: switching technology preserves compatible selections.
    const controls = element.selectors.filter((selector) =>
      element.variants.some((variant) => {
        const value = variant.selection[selector.name];

        return value !== undefined && !Number.isFinite(Number(value));
      }),
    );

    return element.selectors.map((selector) => {
      const index = controls.findIndex((control) => control.name === selector.name);
      const dependencies = index < 0 ? controls : controls.slice(0, index);
      const available = element.variants.filter((variant) =>
        dependencies.every((control) => variant.selection[control.name] === values.get(control.name)),
      );

      return {
        ...selector,
        values: [
          ...new Set(
            available.flatMap((variant) => {
              const value = variant.selection[selector.name];

              return value === undefined ? [] : [value];
            }),
          ),
        ],
      };
    });
  }

  syncDefaults(state: LibraryDefaultState): void {
    if (!this.elements.some((element) => element.id === state.elementId)) return;
    this.elementId = state.elementId;
    this.#opened = state.elementId;
    this.resolution = {
      values: new Map(state.values),
      choices: this.#choices(state.values),
      errors: [],
    };
    this.#variant = this.element?.resolve
      ? { selection: {}, defaults: Object.fromEntries(state.values), connectors: state.connectors }
      : this.element?.variants.find((variant) =>
          Object.entries(variant.selection).every(([name, value]) => state.values.get(name) === value),
        );
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
    if (!this.element) return;
    const connectors = this.#variant?.connectors ?? this.element.connectors;
    this.openRequested.emit(
      {
        id: this.elementId,
        files: this.#files,
        values: this.resolution.values,
        connectors,
        defaults: new LibraryDefaults(
          this.elements.filter((element) => element.entry === this.element!.entry && !element.error),
          this.#parameters,
          {
            elementId: this.element.id,
            values: this.resolution.values,
            connectors,
            options: this.element.resolve?.(this.resolution.values).options,
          },
        ),
      },
      replaceSource,
    );
  }
}

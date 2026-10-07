import { FunctionWorkspace } from '@/entities/source-function';
import { Observable, Signal } from '@/shared/lib/observable';
import { GeometryRuntime, type RuntimeParameterRequest } from '@engine/runtime';
import { libraries } from '@/features/element-library/config/libraries';
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
}

export class ElementLibraryModel extends Observable {
  readonly assets = libraries;
  readonly openRequested = new Signal<[sample: LibrarySample, replaceSource: boolean]>();
  libraryName = '';
  elementId = '';
  elements: LibraryElement[] = [];
  busy = false;
  error = '';
  notice = '';
  resolution: LibraryResolution = { values: new Map(), choices: [], errors: [] };
  readonly #cache = new Map<string, { library: ElementLibrary; sources: LibrarySource[] }>();
  #sources: LibrarySource[] = [];
  #files: LibrarySource[] = [];
  #variant: LibraryVariant | undefined;
  #parameters: RuntimeParameterRequest[] = [];
  #selection = new Map<string, string>();
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
    this.notice = '';
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

        const [presets, ...codes] = await Promise.all([
          read(asset.presets),
          ...asset.sources.map((source) => read(source.path)),
        ]);
        cached = {
          library: JSON.parse(presets) as ElementLibrary,
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
    this.#selection.clear();
    this.error = '';
    this.notice = '';
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

  #resolve(): void {
    const element = this.element;
    if (!element) return;
    this.#variant = element.variants.find((variant) =>
      [...this.#selection].every(([name, value]) => variant.selection[name] === value),
    );
    this.resolution = {
      values: new Map(Object.entries({ ...element.defaults, ...this.#variant?.selection, ...this.#variant?.defaults })),
      choices: element.selectors.map((selector) => ({
        ...selector,
        values: [
          ...new Set(
            element.variants.flatMap((variant) =>
              variant.selection[selector.name] === undefined ? [] : [variant.selection[selector.name]],
            ),
          ),
        ],
      })),
      errors: this.#variant ? [] : ['No preset for this size/variant.'],
    };
    const missing = [
      ...new Set(
        this.#parameters
          .filter((parameter) => parameter.sourceFunction === 'get_val' && !this.resolution.values.has(parameter.name))
          .map((parameter) => parameter.name),
      ),
    ];
    this.notice = missing.length
      ? `No preset value for: ${missing.join(', ')}. Check these parameters before building.`
      : '';
  }

  readonly selectValue = (name: string, value: string): void => {
    this.#selection.set(name, value);
    this.#resolve();
    if (this.resolution.errors.length) {
      this.#selection = new Map([[name, value]]);
      this.#resolve();
    }
    this.changed();
    if (this.#opened === this.elementId && this.canOpen) this.#publish(false);
  };

  readonly reset = (): void => {
    this.#selection.clear();
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
    this.openRequested.emit(
      {
        id: this.elementId,
        files: this.#files,
        values: this.resolution.values,
        connectors: this.#variant?.connectors ?? this.element.connectors,
      },
      replaceSource,
    );
  }
}

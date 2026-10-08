import { parameterKey, type RuntimeParameterRequest } from '@engine/runtime';
import type { LibraryElement } from '@/features/element-library/model/types';

export interface LibraryDefaultState {
  values: ReadonlyMap<string, string>;
  connectors: LibraryElement['connectors'];
  parameters?: ReadonlyMap<string, string>;
}

interface Preset extends LibraryDefaultState {
  selectors: string[];
}

function comparable(value: string | undefined): string | undefined {
  if (value === 'true') return '1';
  if (value === 'false') return '0';

  return value?.trim() && Number.isFinite(Number(value)) ? String(Number(value)) : value;
}

// Reuse the prepared XML rows for functions shared by several catalogue elements.
// Only branch/connection selectors change presets; ordinary dimensions remain editable.
export class LibraryDefaults {
  readonly #presets: Preset[];
  readonly #keys = new Map<string, string>();
  readonly #controls: string[];
  readonly #saved = new Map<string, LibraryDefaultState>();
  readonly #initial: LibraryDefaultState;
  #current: LibraryDefaultState;
  #parameters: ReadonlyMap<string, string>;

  constructor(
    elements: readonly LibraryElement[],
    definitions: readonly RuntimeParameterRequest[],
    initial: LibraryDefaultState,
  ) {
    this.#presets = elements.flatMap((element) =>
      element.variants.map((variant) => ({
        values: new Map(Object.entries({ ...element.defaults, ...variant.selection, ...variant.defaults })),
        connectors: variant.connectors ?? element.connectors,
        selectors: element.selectors.map((selector) => selector.name),
      })),
    );
    for (const definition of definitions)
      if (!this.#keys.has(definition.name)) this.#keys.set(definition.name, parameterKey(definition));
    const controls = new Set(
      definitions.filter((definition) => definition.branchSelector).map((definition) => definition.name),
    );
    for (const preset of this.#presets)
      for (const name of preset.selectors) {
        const value = preset.values.get(name);
        if (value && !Number.isFinite(Number(value))) controls.add(name);
      }
    this.#controls = [...controls].filter(
      (name) =>
        definitions.some((definition) => definition.name === name && definition.branchSelector === 'switch') ||
        this.#presets.some((preset) => preset.values.has(name)),
    );
    this.#initial = initial;
    this.#current = initial;
    this.#parameters = initial.values;
  }

  #value(values: ReadonlyMap<string, string>, name: string): string | undefined {
    return values.get(this.#keys.get(name) ?? name) ?? values.get(name);
  }

  #key(values: ReadonlyMap<string, string>): string {
    return JSON.stringify(this.#controls.map((name) => comparable(this.#value(values, name))));
  }

  remember(parameters: ReadonlyMap<string, string>): void {
    this.#parameters = new Map(parameters);
  }

  reset(): LibraryDefaultState {
    this.#saved.clear();
    this.#current = this.#initial;
    this.remember(this.#initial.values);

    return this.#initial;
  }

  change(
    parameters: ReadonlyMap<string, string>,
    connectors: LibraryElement['connectors'],
  ): LibraryDefaultState | null {
    const changed = this.#controls.filter(
      (name) => comparable(this.#value(parameters, name)) !== comparable(this.#value(this.#parameters, name)),
    );
    if (!changed.length) {
      this.remember(parameters);

      return null;
    }
    const previousKey = this.#key(this.#parameters);
    this.#saved.delete(previousKey);
    this.#saved.set(previousKey, {
      ...this.#current,
      parameters: this.#parameters,
      connectors: structuredClone(connectors),
    });
    const candidates = this.#presets.filter((preset) =>
      changed.every((name) => comparable(preset.values.get(name)) === comparable(this.#value(parameters, name))),
    );

    const matches = (preset: LibraryDefaultState, names: readonly string[]) =>
      names.filter((name) => comparable(preset.values.get(name)) === comparable(this.#value(parameters, name))).length;

    candidates.sort(
      (a, b) =>
        matches(b, this.#controls) - matches(a, this.#controls) || matches(b, b.selectors) - matches(a, a.selectors),
    );
    const preset = candidates[0];
    const saved = [...this.#saved.values()]
      .reverse()
      .filter((state) =>
        changed.every(
          (name) =>
            comparable(this.#value(state.parameters ?? state.values, name)) ===
            comparable(this.#value(parameters, name)),
        ),
      )
      .sort((a, b) => matches(b, this.#controls) - matches(a, this.#controls))[0];
    const next =
      saved && (!preset || matches(saved, this.#controls) >= matches(preset, this.#controls)) ? saved : preset;
    if (!next) {
      // Preserve editable values and connectors until a matching preset is selected.
      this.remember(parameters);

      return null;
    }
    this.#current = next;
    this.remember(this.#current.parameters ?? this.#current.values);

    return this.#current;
  }
}

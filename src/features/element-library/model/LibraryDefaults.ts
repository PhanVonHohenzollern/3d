import { parameterKey, type RuntimeParameterRequest } from '@engine/runtime';
import type { LibraryElement } from '@/features/element-library/model/types';
import { sameValue } from '@/features/element-library/model/xmlRules';

export interface LibraryDefaultState {
  elementId: string;
  values: ReadonlyMap<string, string>;
  connectors: LibraryElement['connectors'];
  parameters?: ReadonlyMap<string, string>;
  options?: ReadonlyMap<string, string[]>;
}

function comparable(value: string | undefined): string | undefined {
  if (value === 'true') return '1';
  if (value === 'false') return '0';

  return value?.trim() && Number.isFinite(Number(value)) ? String(Number(value)) : value;
}

// Resolve the current XML rows after any edit, preserving independent values
// and the saved state of each geometry case.
export class LibraryDefaults {
  readonly #elements: readonly LibraryElement[];
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
    this.#elements = elements;
    for (const definition of definitions)
      if (!this.#keys.has(definition.name)) this.#keys.set(definition.name, parameterKey(definition));
    for (const element of elements)
      for (const { name } of element.selectors) if (!this.#keys.has(name)) this.#keys.set(name, name);
    const controls = new Set(
      definitions.filter((definition) => definition.branchSelector).map((definition) => definition.name),
    );
    for (const element of elements) for (const name of element.controls ?? []) controls.add(name);
    for (const element of elements)
      for (const selector of element.selectors) {
        const value = element.resolve?.().values.get(selector.name);
        if (value && !Number.isFinite(Number(value))) controls.add(selector.name);
      }
    this.#controls = [...controls].filter(
      (name) =>
        definitions.some((definition) => definition.name === name && definition.branchSelector === 'switch') ||
        elements.some((element) => element.resolve?.().options.has(name)),
    );
    this.#initial = initial;
    this.#current = initial;
    this.#parameters = initial.values;
  }

  #value(values: ReadonlyMap<string, string>, name: string): string | undefined {
    return values.get(this.#keys.get(name) ?? name) ?? values.get(name);
  }

  #key(elementId: string, values: ReadonlyMap<string, string>): string {
    return JSON.stringify([elementId, ...this.#controls.map((name) => comparable(this.#value(values, name)))]);
  }

  remember(parameters: ReadonlyMap<string, string>): void {
    this.#parameters = new Map(parameters);
  }

  get options(): ReadonlyMap<string, string[]> {
    const options = new Map(this.#current.options);
    for (const name of this.#controls) {
      const choices = this.#elements.flatMap((element) => element.resolve?.().options.get(name) ?? []);
      if (choices.length) options.set(name, [...new Set(choices)]);
    }

    return options;
  }

  get selectors(): string[] {
    return (
      this.#elements.find((element) => element.id === this.#current.elementId)?.selectors.map(({ name }) => name) ?? []
    );
  }

  reset(): LibraryDefaultState {
    this.#saved.clear();
    this.#current = this.#initial;
    this.remember(this.#initial.values);

    return { ...this.#initial, options: this.options };
  }

  change(
    parameters: ReadonlyMap<string, string>,
    connectors: LibraryElement['connectors'],
  ): LibraryDefaultState | null {
    const changed = [...this.#keys.keys()].filter(
      (name) => !sameValue(this.#value(parameters, name), this.#value(this.#parameters, name)),
    );
    if (!changed.length) {
      this.remember(parameters);

      return null;
    }
    const previousKey = this.#key(this.#current.elementId, this.#parameters);
    this.#saved.set(previousKey, {
      ...this.#current,
      parameters: new Map(this.#parameters),
      connectors: structuredClone(connectors),
    });
    let element = this.#elements.find((element) => element.id === this.#current.elementId)!;
    const controls = changed.filter((name) => this.#controls.includes(name));

    const supports = (candidate: LibraryElement) => {
      const options = candidate.resolve?.().options;

      return controls.every((name) =>
        options?.get(name)?.some((value) => sameValue(value, this.#value(parameters, name))),
      );
    };

    if (controls.length && !supports(element))
      element =
        this.#elements.find((item) => item.id === this.#initial.elementId && supports(item)) ??
        this.#elements.find(supports) ??
        element;
    const switching = element.id !== this.#current.elementId;
    const values = new Map(switching ? element.resolve?.().values : this.#current.values);
    if (switching) {
      for (const selector of element.selectors) {
        const value = this.#current.values.get(selector.name);
        if (value !== undefined && element.resolve?.().options.get(selector.name)?.includes(value))
          values.set(selector.name, value);
      }
    }
    if (!switching) {
      for (const name of this.#keys.keys()) {
        const value = this.#value(parameters, name);
        if (value !== undefined) values.set(name, value);
      }
    }
    for (const name of changed) {
      const value = this.#value(parameters, name);
      if (value !== undefined) values.set(name, value);
    }
    const selected = switching
      ? element.selectors
          .map((selector) => selector.name)
          .filter((name) => !sameValue(values.get(name), element.resolve?.().values.get(name)))
      : [];
    const resolved = element.resolve!(values, [...new Set([...changed, ...selected])]);
    if (JSON.stringify(resolved.connectors) === JSON.stringify(this.#current.connectors))
      resolved.connectors = connectors;
    const saved = switching ? this.#saved.get(this.#key(element.id, resolved.values)) : undefined;
    const nextParameters = new Map(saved?.parameters ?? parameters);
    for (const [name, key] of this.#keys) {
      const value = saved?.values.get(name) ?? resolved.values.get(name);
      if (value !== undefined) {
        nextParameters.set(name, value);
        nextParameters.set(key, value);
      }
    }
    this.#current = saved ?? { elementId: element.id, ...resolved, parameters: nextParameters };
    this.remember(this.#current.parameters ?? this.#current.values);

    return { ...this.#current, options: this.options };
  }
}

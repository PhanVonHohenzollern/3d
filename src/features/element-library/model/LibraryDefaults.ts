import { isInsulationQuery, parameterKey, type RuntimeParameterRequest } from '@engine/runtime';
import type { ResolvedSnapshot } from '@/features/element-library/model/constraintGraph';
import type { LibraryElement } from '@/features/element-library/model/types';
import { sameValue } from '@/features/element-library/model/values';
import type { ParameterBindingMode } from '@/entities/parameter';

export interface LibraryDefaultState {
  elementId: string;
  snapshot: ResolvedSnapshot;
  values: ReadonlyMap<string, string>;
  connectors: LibraryElement['connectors'];
  parameters?: ReadonlyMap<string, string>;
  options?: ReadonlyMap<string, string[]>;
}

// Graph snapshots are the only source of library configuration state.
// Independent runtime-only parameters never become graph inputs.
export class LibraryDefaults {
  readonly #elements: readonly LibraryElement[];
  readonly #keys = new Map<string, string>();
  readonly #controls: string[];
  readonly #initial: LibraryDefaultState;
  #current: LibraryDefaultState;
  #parameters: ReadonlyMap<string, string>;

  constructor(
    elements: readonly LibraryElement[],
    definitions: readonly RuntimeParameterRequest[],
    initial: LibraryDefaultState,
  ) {
    if (initial.snapshot.status !== 'valid') throw new Error('Cannot commit an unresolved library configuration');
    this.#elements = elements;
    for (const definition of definitions)
      if (!isInsulationQuery(definition.sourceFunction) && !this.#keys.has(definition.name))
        this.#keys.set(definition.name, parameterKey(definition));
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
    const scoped = this.#keys.get(name) ?? name;

    return values.get(scoped) ?? values.get(name);
  }

  #editedValue(values: ReadonlyMap<string, string>, name: string): string | undefined {
    const scoped = this.#keys.get(name) ?? name;
    // Some panels update only the visible key while keeping a stale scoped
    // get_val copy (or vice versa). Pick the key that actually changed.
    if (scoped !== name) {
      const scopedValue = values.get(scoped);
      const plainValue = values.get(name);
      if (scopedValue !== undefined && !sameValue(scopedValue, this.#parameters.get(scoped))) return scopedValue;
      if (plainValue !== undefined && !sameValue(plainValue, this.#parameters.get(name))) return plainValue;
    }

    return this.#value(values, name);
  }

  remember(parameters: ReadonlyMap<string, string>): void {
    this.#parameters = new Map(parameters);
    this.#current = { ...this.#current, parameters: this.#parameters };
  }

  get options(): ReadonlyMap<string, string[]> {
    const options = new Map(this.#current.options);
    // Cross-entity choices are displayed only for case-switch controls, and
    // come exclusively from other *valid* JSON graph snapshots. They are not
    // copied into parameter values or a geometry snapshot.
    for (const name of this.#controls) {
      const choices = this.#elements.flatMap((element) => {
        // The current entity's domains depend on the selected technology.
        // Re-resolving its defaults would restore the previous connection list.
        if (element.id === this.#current.elementId) return [];
        const result = element.resolve();
        if (result.snapshot.status !== 'valid') return [];

        return result.options.get(name) ?? (result.values.has(name) ? [result.values.get(name)!] : []);
      });
      if (choices.length) options.set(name, [...new Set([...(options.get(name) ?? []), ...choices])]);
    }

    return options;
  }

  get selectors(): string[] {
    return (
      this.#elements.find((element) => element.id === this.#current.elementId)?.selectors.map(({ name }) => name) ?? []
    );
  }

  // UI must allow free text for these fields; options are suggestions only.
  get nonrestrictiveParameters(): ReadonlySet<string> {
    return this.#current.snapshot.nonrestrictiveParameters;
  }

  get parameterModes(): ReadonlyMap<string, ParameterBindingMode> {
    return this.#current.snapshot.parameterModes ?? new Map();
  }

  get hiddenParameters(): ReadonlySet<string> {
    const element = this.#elements.find((element) => element.id === this.#current.elementId);
    if (!element) return new Set();

    // Scope C++ keys to this entity, leaving same-name helper parameters independent.
    return new Set((element.hiddenParameters ?? []).flatMap((name) => [name, `${element.entry}::${name}`]));
  }

  get currentState(): LibraryDefaultState {
    return structuredClone({ ...this.#current, options: this.options });
  }

  reset(): LibraryDefaultState {
    this.#current = structuredClone(this.#initial);
    this.remember(this.#initial.parameters ?? this.#initial.values);

    return this.currentState;
  }

  change(
    parameters: ReadonlyMap<string, string>,
    _connectors: LibraryElement['connectors'],
  ): LibraryDefaultState | null {
    const hidden = this.hiddenParameters;
    const modes = this.parameterModes;
    const selectors = new Set(this.selectors);
    const changed = [...this.#keys.keys()].filter(
      (name) =>
        !sameValue(
          this.#editedValue(parameters, name),
          this.#value(this.#parameters, name) ?? this.#current.snapshot.resolvedValues.get(name),
        ) &&
        !hidden.has(name) &&
        modes.get(name) !== 'secondary' &&
        (this.#current.snapshot.resolvedValues.has(name) || selectors.has(name) || this.#controls.includes(name)),
    );
    if (!changed.length) {
      this.remember(parameters);

      return null;
    }

    let element = this.#elements.find((item) => item.id === this.#current.elementId)!;
    const controls = changed.filter((name) => this.#controls.includes(name));

    const supports = (candidate: LibraryElement) => {
      const result = candidate.resolve();
      if (result.snapshot.status !== 'valid') return false;

      return controls.every((name) =>
        (result.options.get(name) ?? [result.values.get(name)]).some((value) =>
          sameValue(value, this.#editedValue(parameters, name)),
        ),
      );
    };

    if (controls.length && !supports(element))
      element =
        this.#elements.find((item) => item.id === this.#initial.elementId && supports(item)) ??
        this.#elements.find(supports) ??
        element;

    const switching = element.id !== this.#current.elementId;
    const baseline = switching ? element.resolve() : undefined;
    if (baseline && baseline.snapshot.status !== 'valid') throw new Error('Cannot switch to an unresolved JSON entity');
    const values = new Map(switching ? baseline!.snapshot.resolvedValues : this.#current.snapshot.resolvedValues);
    const allowedNames = new Set([...values.keys(), ...element.selectors.map((selector) => selector.name)]);
    if (switching) {
      // Carry only shared, explicitly supported selectors; do not restore
      // obsolete per-case dimensions or saved connectors.
      for (const selector of element.selectors) {
        const value = this.#current.snapshot.resolvedValues.get(selector.name);
        if (value !== undefined && baseline!.options.get(selector.name)?.some((v) => sameValue(v, value)))
          values.set(selector.name, value);
      }
    }
    const edited = changed.filter((name) => allowedNames.has(name));
    for (const name of edited) {
      const value = this.#editedValue(parameters, name);
      if (
        this.parameterModes.get(name) === 'restrictive' &&
        !this.options.get(name)?.some((option) => sameValue(option, value))
      )
        throw new Error(`${name}: select a value from the list`);
      if (value !== undefined) values.set(name, value);
    }
    if (!switching && !edited.length) {
      this.remember(parameters);

      return null;
    }
    const selected = switching
      ? element.selectors
          .map(({ name }) => name)
          .filter((name) => !sameValue(values.get(name), baseline!.values.get(name)))
      : [];
    const resolved = element.resolve(values, [...new Set([...edited, ...selected])]);
    if (resolved.snapshot.status !== 'valid')
      throw new Error(resolved.errors?.join('; ') || `Configuration is ${resolved.snapshot.status}`);

    const nextParameters = new Map(parameters);
    const declared = new Set([...element.selectors.map(({ name }) => name), ...(element.hiddenParameters ?? [])]);
    for (const [name, key] of this.#keys) {
      // C++-only inputs are independent of the JSON graph. Preserve their
      // defaults/edits while another field triggers constraint resolution.
      if (!switching && !declared.has(name) && !resolved.snapshot.resolvedValues.has(name)) continue;
      nextParameters.delete(name);
      nextParameters.delete(key);
      const value = resolved.snapshot.resolvedValues.get(name);
      if (value !== undefined) {
        nextParameters.set(name, value);
        nextParameters.set(key, value);
      }
    }
    this.#current = { elementId: element.id, ...resolved, parameters: nextParameters };
    this.remember(nextParameters);

    return this.currentState;
  }
}

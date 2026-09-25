import {
  mainFunctionName,
  removeFunctionSource,
  sourceFunctions,
  validFunctionCode,
  type SourceFunction,
} from '../../helpers/functions';
import type { RuntimeExecutionOptions } from '../../core/runtime/GeometryRuntime';

export interface FunctionProgram {
  source: string;
  options: RuntimeExecutionOptions;
  locations: { start: number; end: number; name: string; localStart: number }[];
}

export class FunctionWorkspace {
  mainSource = '';
  active = '';
  error = '';
  readonly saved = new Map<string, string>();
  readonly drafts = new Map<string, string>();
  readonly inputs = new Map<string, Map<string, string[]>>();
  readonly deleted = new Set<string>();
  private readonly signatures = new Map<string, string>();
  inputTab = '';

  get inline() {
    return sourceFunctions(this.mainSource);
  }

  get names(): string[] {
    return [...new Set([...this.signatures.keys(), ...this.saved.keys(), ...this.drafts.keys()])];
  }

  private inlineFor(name: string): SourceFunction | undefined {
    return this.inline.find((fn) => fn.signature === this.signatures.get(name));
  }

  savedSource(name: string): string | undefined {
    return this.inlineFor(name)?.code ?? this.saved.get(name);
  }

  private labelFor(fn: SourceFunction): string | undefined {
    return [...this.signatures].find(([, signature]) => signature === fn.signature)?.[0];
  }

  source(name = this.active): string {
    if (!name) return this.mainSource;

    return this.drafts.get(name) ?? this.savedSource(name) ?? '';
  }

  edit(source: string): void {
    if (this.active) {
      const saved = this.savedSource(this.active);
      if (source === saved) this.drafts.delete(this.active);
      else this.drafts.set(this.active, source);
    } else {
      const previous = this.inline;
      const next = sourceFunctions(source);
      // Removing a definition in Main detaches it; only Delete removes its editor.
      for (const fn of previous) {
        const label = this.labelFor(fn);
        if (!label || next.some((item) => item.signature === fn.signature)) continue;
        const sameName = next.filter((item) => item.name === fn.name);
        if (sameName.length === 1 && previous.filter((item) => item.name === fn.name).length === 1)
          this.signatures.set(label, sameName[0].signature);
        else this.saved.set(label, fn.code);
      }
      this.mainSource = source;
      const main = mainFunctionName(source) ? next[0] : undefined;
      for (const fn of next) {
        if (fn === main) continue;
        let label = this.labelFor(fn);
        if (!label) {
          const base = next.filter((item) => item.name === fn.name).length > 1 ? fn.signature : fn.name;
          label = base;
          for (let i = 2; this.names.includes(label); ++i) label = `${base} (${i})`;
          this.signatures.set(label, fn.signature);
        }
        this.deleted.delete(label);
      }
    }
  }

  add(raw: string): boolean {
    const name = raw.trim();
    if (!name) {
      this.error = 'Enter a tab name.';

      return false;
    }
    if (name === 'Main' || this.names.includes(name)) {
      this.error = 'Name already exists. Enter a unique tab name.';

      return false;
    }
    const used = new Set([...this.inline, ...[...this.saved.values()].flatMap(sourceFunctions)].map((fn) => fn.name));
    let symbol = /^[A-Za-z_]\w*$/.test(name) && !validFunctionCode(`void ${name}() {}`, name) ? name : 'subFunction';
    for (let i = 2; used.has(symbol); ++i) symbol = `subFunction${i}`;
    this.drafts.set(name, `void ${symbol}()\n{\n\n}\n`);
    this.deleted.delete(name);
    this.active = name;
    this.error = '';

    return true;
  }

  save(): boolean {
    const code = this.source();
    this.error = validFunctionCode(code) ?? '';
    if (this.error) return false;
    const fn = sourceFunctions(code)[0];
    const inline = this.inlineFor(this.active);
    if (
      this.inline.some((other) => other.signature === fn.signature && other.signature !== inline?.signature) ||
      this.names.some(
        (name) =>
          name !== this.active && sourceFunctions(this.source(name)).some((other) => other.signature === fn.signature),
      )
    ) {
      this.error = `Function already exists: ${fn.signature}.`;

      return false;
    }
    if (inline) this.mainSource = this.mainSource.slice(0, inline.from) + code + this.mainSource.slice(inline.to);
    this.saved.set(this.active, code);
    this.signatures.set(this.active, fn.signature);
    this.drafts.delete(this.active);
    this.active = '';

    return true;
  }

  cancel(): void {
    this.drafts.delete(this.active);
    this.active = '';
    this.error = '';
  }

  removeActive(): string | null {
    const name = this.active;
    if (!name || !this.names.includes(name)) return null;
    const fn = this.inlineFor(name) ?? sourceFunctions(this.saved.get(name) ?? this.source(name))[0];
    if (fn) this.mainSource = removeFunctionSource(this.mainSource, fn.name, fn.signature);
    this.saved.delete(name);
    this.drafts.delete(name);
    this.signatures.delete(name);
    this.inputs.delete(name);
    this.deleted.add(name);
    this.active = '';
    this.inputTab = '';
    this.error = '';

    return name;
  }

  attach(): boolean {
    const fn = sourceFunctions(this.source())[0];
    if (fn && this.inline.some((other) => other.signature === fn.signature)) {
      this.error = 'Function already exists.';

      return false;
    }
    if (!this.saved.has(this.active) || this.source() !== this.saved.get(this.active)) {
      this.error = 'Save the function before attaching.';

      return false;
    }
    this.mainSource = `${this.mainSource.trimEnd()}\n\n${this.source().trim()}\n`;
    this.error = '';

    return true;
  }

  get parameterFunctions() {
    return this.names.flatMap((name) => {
      const fn = sourceFunctions(this.source(name))[0];

      return fn?.inputs.length ? [{ ...fn, name }] : [];
    });
  }

  inputValues(name: string, parameter: string, initial: string[]): string[] {
    const saved = this.inputs.get(name)?.get(parameter);

    return initial.map((value, index) => saved?.[index] ?? value);
  }

  setInput(name: string, parameter: string, initial: string[], index: number, value: string): void {
    const values = [...this.inputValues(name, parameter, initial)];
    values[index] = value;
    const inputs = this.inputs.get(name) ?? new Map<string, string[]>();
    inputs.set(parameter, values);
    this.inputs.set(name, inputs);
  }

  program(editorSource = this.source(), validateArguments = true): FunctionProgram {
    const main = this.active ? this.mainSource : editorSource;
    const inline = sourceFunctions(main);
    const sourceParts = [{ code: editorSource, name: this.active }];
    if (this.active) {
      // Keep definitions and global declarations available without executing the main element.
      const current = this.inlineFor(this.active);
      sourceParts.push({
        name: '',
        code: current
          ? main.slice(0, current.from) +
            main.slice(current.from, current.to).replace(/[^\n]/g, ' ') +
            main.slice(current.to)
          : main,
      });
    }
    for (const [name, code] of this.saved)
      if (name !== this.active && !inline.some((fn) => fn.signature === this.signatures.get(name)))
        sourceParts.push({ name, code });
    const arguments_ = new Map<string, string>();
    const fn = this.active ? sourceFunctions(editorSource)[0] : undefined;
    for (const input of fn?.inputs ?? []) {
      if (!this.inputs.get(this.active)?.has(input.name)) continue;
      const values = this.inputValues(this.active, input.name, input.initial);
      if (validateArguments && input.kind === 'unsupported')
        throw new Error(`Unsupported preview input type: ${input.type}.`);
      if (
        validateArguments &&
        input.kind !== 'text' &&
        input.kind !== 'bool' &&
        values.some((v) => !v.trim() || !Number.isFinite(Number(v)))
      )
        throw new Error(`Enter a number for ${input.name}.`);
      arguments_.set(
        input.name,
        input.kind === 'point' || input.kind === 'vector'
          ? `${input.kind === 'point' ? 'FdPoint3d' : 'FdVector3d'}(${values.join(',')})`
          : input.kind === 'text'
            ? JSON.stringify(values[0])
            : values[0],
      );
    }

    let start = 1;
    const locations: FunctionProgram['locations'] = [];
    for (const part of sourceParts) {
      const count = part.code.split('\n').length;
      locations.push({ start, end: start + count - 1, name: part.name, localStart: 1 });
      if (!part.name && start > 1) {
        for (const fn of sourceFunctions(part.code)) {
          const label = this.labelFor(fn);
          if (!label) continue;
          const localLine = part.code.slice(0, fn.from).split('\n').length;
          locations.push({
            start: start + localLine - 1,
            end: start + localLine + fn.code.split('\n').length - 2,
            name: label,
            localStart: 1,
          });
        }
      }
      start += count + 1;
    }

    const functionScopes = new Map<string, string>();
    if (mainFunctionName(main) && inline[0])
      functionScopes.set(inline[0].signature, this.names.includes(inline[0].name) ? 'Main' : inline[0].name);
    for (const name of this.names) {
      const definition = sourceFunctions(name === this.active ? editorSource : (this.savedSource(name) ?? ''))[0];
      if (definition) functionScopes.set(definition.signature, name);
    }

    return {
      source: sourceParts.map((part) => part.code).join('\n\n'),
      locations,
      options: {
        entryFunction: this.active ? (fn?.name ?? null) : mainFunctionName(main),
        entrySignature: this.active ? fn?.signature : inline[0]?.signature,
        functionScopes,
        arguments: arguments_,
        isolated: !!this.active,
      },
    };
  }
}

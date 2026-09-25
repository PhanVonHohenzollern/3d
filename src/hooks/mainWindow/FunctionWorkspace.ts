import {
  declaredFunctionNames,
  mainFunctionName,
  removeFunctionSource,
  sourceFunctions,
  validFunctionCode,
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
  inputTab = '';

  get inline() {
    return sourceFunctions(this.mainSource);
  }

  get names(): string[] {
    const main = mainFunctionName(this.mainSource);

    return [
      ...new Set([
        ...this.inline.filter((fn) => fn.name !== main).map((fn) => fn.name),
        ...this.saved.keys(),
        ...this.drafts.keys(),
      ]),
    ];
  }

  source(name = this.active): string {
    if (!name) return this.mainSource;

    return this.drafts.get(name) ?? this.inline.find((fn) => fn.name === name)?.code ?? this.saved.get(name) ?? '';
  }

  edit(source: string): void {
    if (this.active) {
      const saved = this.inline.find((fn) => fn.name === this.active)?.code ?? this.saved.get(this.active);
      if (source === saved) this.drafts.delete(this.active);
      else this.drafts.set(this.active, source);
    } else {
      this.mainSource = source;
      for (const fn of this.inline) this.deleted.delete(fn.name);
    }
  }

  add(raw: string): boolean {
    const name = raw.trim();
    if (!/^[A-Za-z_]\w*$/.test(name) || validFunctionCode(`void ${name}() {}`, name)) {
      this.error = 'Enter a valid C++ function name.';

      return false;
    }
    if (declaredFunctionNames(this.mainSource).has(name) || this.names.includes(name)) {
      this.error = 'Function already exists. Enter a unique function name.';

      return false;
    }
    this.drafts.set(name, `void ${name}()\n{\n\n}\n`);
    this.deleted.delete(name);
    this.active = name;
    this.error = '';

    return true;
  }

  save(): boolean {
    const code = this.source();
    this.error = validFunctionCode(code, this.active) ?? '';
    if (this.error) return false;
    const inline = this.inline.find((fn) => fn.name === this.active);
    if (inline) this.mainSource = this.mainSource.slice(0, inline.from) + code + this.mainSource.slice(inline.to);
    this.saved.set(this.active, code);
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
    this.mainSource = removeFunctionSource(this.mainSource, name);
    this.saved.delete(name);
    this.drafts.delete(name);
    this.inputs.delete(name);
    this.deleted.add(name);
    this.active = '';
    this.inputTab = '';
    this.error = '';

    return name;
  }

  attach(): boolean {
    if (declaredFunctionNames(this.mainSource).has(this.active)) {
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
      const fn = sourceFunctions(this.source(name)).find((fn) => fn.name === name);

      return fn?.inputs.length ? [fn] : [];
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
      const current = inline.find((fn) => fn.name === this.active);
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
      if (name !== this.active && !inline.some((fn) => fn.name === name)) sourceParts.push({ name, code });
    const arguments_ = new Map<string, string>();
    const fn = sourceFunctions(editorSource).find((fn) => fn.name === this.active);
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
          if (fn.name === mainFunctionName(main)) continue;
          const localLine = part.code.slice(0, fn.from).split('\n').length;
          locations.push({
            start: start + localLine - 1,
            end: start + localLine + fn.code.split('\n').length - 2,
            name: fn.name,
            localStart: 1,
          });
        }
      }
      start += count + 1;
    }

    return {
      source: sourceParts.map((part) => part.code).join('\n\n'),
      locations,
      options: {
        entryFunction: this.active || mainFunctionName(main),
        arguments: arguments_,
        isolated: !!this.active,
      },
    };
  }
}

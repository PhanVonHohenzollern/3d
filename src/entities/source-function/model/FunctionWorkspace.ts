import { mainFunctionName, sourceFunctions, type SourceFunction } from '@/entities/source-function/lib/sourceFunctions';
import {
  functionInputValues,
  normalizedParameterType,
  type RuntimeApiCall,
  type RuntimeExecutionOptions,
  type RuntimeResult,
} from '@engine/runtime';

export interface FunctionProgram {
  source: string;
  options: RuntimeExecutionOptions;
  locations: { start: number; end: number; name: string; localStart: number }[];
  editorFile: string;
}

export interface WorkspaceFunction extends SourceFunction {
  functionName: string;
  file: string;
  line: number;
}

export class FunctionWorkspace {
  readonly #files = new Map<string, string>([['', '']]);
  #activeFile = '';
  #active = '';
  #inputTab = '';
  #error = '';
  readonly #calls = new Map<string, RuntimeApiCall[]>();
  readonly #occurrences = new Map<string, number>();
  readonly #inputs = new Map<string, Map<string, string[]>>();
  #definitions: WorkspaceFunction[] | undefined;

  get mainSource(): string {
    return this.#files.get('') ?? '';
  }

  get activeFile(): string {
    return this.#activeFile;
  }

  get active(): string {
    return this.#active;
  }

  get error(): string {
    return this.#error;
  }

  get inputTab(): string {
    return this.#inputTab;
  }

  get fileNames(): string[] {
    return [...this.#files.keys()].filter(Boolean);
  }

  get inline(): readonly SourceFunction[] {
    return sourceFunctions(this.mainSource);
  }

  get names(): string[] {
    return this.functions.map((fn) => fn.name);
  }

  get cacheKey(): string {
    return this.#active ? this.#active + '#' + this.occurrence(this.#active) : '';
  }

  get functions(): WorkspaceFunction[] {
    if (this.#definitions) return this.#definitions;
    const all = [...this.#files].flatMap(([file, code]) =>
      file.endsWith('.h')
        ? []
        : sourceFunctions(code).map((fn) => ({
            ...fn,
            file,
            functionName: fn.name,
            line: code.slice(0, fn.from).split('\n').length,
          })),
    );
    const entry = this.#entry();

    const counts = new Map<string, number>();
    for (const fn of all) counts.set(fn.name, (counts.get(fn.name) ?? 0) + 1);
    this.#definitions = all
      .filter((fn) => fn.file !== '' || fn.signature !== entry?.signature)
      .map((fn) => ({
        ...fn,
        name: counts.get(fn.name)! > 1 ? fn.signature : fn.name,
      }));

    return this.#definitions;
  }

  get parameterFunctions(): WorkspaceFunction[] {
    return this.functions.filter((fn) => fn.inputs.length);
  }

  #entry(): SourceFunction | undefined {
    const name = mainFunctionName(this.mainSource);

    return this.inline.find((fn) => fn.name === name);
  }

  source(file = this.#activeFile): string {
    return this.#files.get(file) ?? '';
  }

  edit(code: string): void {
    if (code === this.source()) return;
    this.#files.set(this.#activeFile, code);
    this.#definitions = undefined;
    if (this.#active && !this.names.includes(this.#active)) this.#active = '';
  }

  reportError(message: string): void {
    this.#error = message;
  }

  clearError(): void {
    this.#error = '';
  }

  addFiles(raw: string, header: boolean): boolean {
    const base = raw.trim().replace(/\.(h|cpp)$/i, '');
    if (!/^[A-Za-z_][\w.-]*$/.test(base)) {
      this.#error = 'Enter a file name using letters, numbers, underscores, dots or hyphens.';

      return false;
    }
    const names = header ? [base + '.h', base + '.cpp'] : [base + '.cpp'];
    if (
      names.some(
        (name) =>
          name.toLowerCase() === 'main.cpp' || this.fileNames.some((file) => file.toLowerCase() === name.toLowerCase()),
      )
    ) {
      this.#error = 'A file with this name already exists.';

      return false;
    }
    for (const name of names) this.#files.set(name, '');
    this.#definitions = undefined;
    this.selectFile(names[0]);

    return true;
  }

  selectFile(file: string): void {
    if (!this.#files.has(file)) return;
    this.#activeFile = file;
    this.#active = '';
    this.clearError();
  }

  openFile(file: string): void {
    if (this.#files.has(file)) this.#activeFile = file;
  }

  select(name: string): void {
    const fn = this.functions.find((item) => item.name === name);
    if (name && !fn) return;
    this.#active = name;
    this.#activeFile = fn?.file ?? '';
    this.#inputTab = name;
    this.clearError();
  }

  removeFile(): string | null {
    const file = this.#activeFile;
    if (!file) return null;
    for (const fn of this.functions.filter((fn) => fn.file === file)) {
      this.#calls.delete(fn.name);
      this.#occurrences.delete(fn.name);
      for (const key of this.#inputs.keys()) if (key.startsWith(fn.name + '#')) this.#inputs.delete(key);
    }
    this.#files.delete(file);
    this.#definitions = undefined;
    this.selectFile('');

    return file;
  }

  tabForCall(call: RuntimeApiCall): string | undefined {
    const signature = call.name + '(' + call.formalParameterTypes.map(normalizedParameterType).join(', ') + ')';

    return this.functions.find((fn) => fn.signature === signature)?.name;
  }

  acceptCalls(result: RuntimeResult): void {
    this.#calls.clear();
    for (const call of result.apiCalls) {
      if (!call.userFunctionCall) continue;
      const name = this.tabForCall(call);
      if (name) {
        const calls = this.#calls.get(name) ?? [];
        calls.push(call);
        this.#calls.set(name, calls);
      }
    }
    for (const [name, index] of this.#occurrences) if (index >= this.calls(name).length) this.#occurrences.set(name, 0);
  }

  calls(name: string): readonly RuntimeApiCall[] {
    return this.#calls.get(name) ?? [];
  }

  occurrence(name = this.#active): number {
    return this.#occurrences.get(name) ?? 0;
  }

  selectOccurrence(index: number): void {
    if (index >= 0 && index < this.calls(this.#active).length) this.#occurrences.set(this.#active, index);
  }

  selectInputTab(name: string): void {
    this.#inputTab = name;
  }

  #inputKey(name: string): string {
    return name + '#' + this.occurrence(name);
  }

  inputValues(name: string, parameter: string, initial: string[]): string[] {
    const saved = this.#inputs.get(this.#inputKey(name))?.get(parameter);
    if (saved) return saved;
    const fn = this.functions.find((fn) => fn.name === name);
    const index = fn?.inputs.findIndex((input) => input.name === parameter) ?? -1;
    const input = fn?.inputs[index];
    const call = this.calls(name)[this.occurrence(name)];
    const value = (call?.boundArguments ?? call?.arguments)?.[index];
    if (input && value !== undefined) return functionInputValues(input, value);

    return input?.kind === 'array'
      ? initial
      : initial.map(() => (input?.kind === 'bool' ? 'false' : input?.kind === 'text' ? '' : '0'));
  }

  setInput(name: string, parameter: string, initial: string[], index: number, value: string): void {
    const values = [...this.inputValues(name, parameter, initial)];
    values[index] = value;
    const key = this.#inputKey(name);
    const inputs = this.#inputs.get(key) ?? new Map<string, string[]>();
    inputs.set(parameter, values);
    this.#inputs.set(key, inputs);
  }

  resetInputs(name: string): void {
    this.#inputs.delete(this.#inputKey(name));
  }

  program(editorSource = this.source(), validate = true, mainOnly = false): FunctionProgram {
    const files = new Map(this.#files);
    files.set(this.#activeFile, editorSource);
    const parts = [...files].sort(([a], [b]) => Number(b.endsWith('.h')) - Number(a.endsWith('.h')));
    let start = 1;
    const locations = parts.map(([name, code]) => {
      const end = start + code.split('\n').length - 1;
      const location = { name, start, end, localStart: 1 };
      start = end + 2;

      return location;
    });
    const entry = this.#entry();
    const fn = mainOnly ? undefined : this.functions.find((fn) => fn.name === this.#active);
    const called = !!fn && this.calls(fn.name).length > 0;
    const options: RuntimeExecutionOptions = {
      entryFunction: fn && !called ? fn.functionName : (entry?.name ?? null),
      entrySignature: fn && !called ? fn.signature : entry?.signature,
      functionScopes: new Map(this.functions.map((fn) => [fn.signature, fn.name])),
    };
    if (fn) {
      options.arguments = this.#arguments(fn, called, validate);
      if (called) options.debugCall = { signature: fn.signature, occurrence: this.occurrence(fn.name) };
      else options.isolated = true;
    }

    return { source: parts.map(([, code]) => code).join('\n\n'), options, locations, editorFile: this.#activeFile };
  }

  #arguments(fn: WorkspaceFunction, called: boolean, validate: boolean): Map<string, string> {
    const args = new Map<string, string>();
    for (const input of fn.inputs) {
      if (called && !this.#inputs.get(this.#inputKey(fn.name))?.has(input.name)) continue;
      const values = this.inputValues(fn.name, input.name, input.initial);
      if (validate && input.kind === 'unsupported') throw new Error('Unsupported preview input type: ' + input.type);
      if (
        validate &&
        ['number', 'point', 'vector'].includes(input.kind) &&
        values.some((v) => !v.trim() || !Number.isFinite(Number(v)))
      )
        throw new Error('Enter a number for ' + input.name + '.');
      if (validate && input.kind === 'bool' && !/^(true|false|0|1)$/i.test(values[0].trim()))
        throw new Error('Enter true, false, 0 or 1 for ' + input.name + '.');
      args.set(
        input.name,
        input.kind === 'point' || input.kind === 'vector'
          ? (input.kind === 'point' ? 'FdPoint3d' : 'FdVector3d') + '(' + values.join(',') + ')'
          : input.kind === 'text'
            ? JSON.stringify(values[0])
            : input.kind === 'bool'
              ? values[0].toLowerCase()
              : values[0],
      );
    }

    return args;
  }
}

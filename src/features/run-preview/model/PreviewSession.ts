import { isFunctionParameterKey } from '@/entities/parameter';
import type { FunctionProgram } from '@/entities/source-function';
import type { EditorExecutionFeedback, PreviewMode } from '@/features/run-preview/model/types';
import { PreviewGeometryEngine, type PreviewGeometryScene } from '@engine/geometry';
import {
  emptyRuntimeResult,
  GeometryRuntime,
  what,
  type RuntimeParameterRequest,
  type RuntimeResult,
} from '@engine/runtime';

export interface TabBuild {
  source: string;
  program: FunctionProgram;
  number: number;
  parameters: ReadonlyMap<string, string>;
}

export type ExecutionOutcome = { result: RuntimeResult } | { error: string };

// Runs the C++ program and keeps what the preview shows: the result, the scene, the feedback for
// the editor, the preview mode, and the Build cache per function tab. Nothing else runs the program.
export class PreviewSession {
  readonly runtime = new GeometryRuntime();
  readonly #engine = new PreviewGeometryEngine();
  #mode: PreviewMode = 'debug';
  #scene: PreviewGeometryScene = { meshes: [], warnings: [] };
  #lastResult: RuntimeResult = emptyRuntimeResult();
  #currentLine = 0;
  #feedback: EditorExecutionFeedback = { source: '', diagnostics: [] };
  #program: FunctionProgram | undefined;
  #buildNumber = 0;
  #buildSequence = 0;
  #previewDirty = false;
  #codeDirty = false;
  #builtSource: string | null = null;
  #builtProgram: FunctionProgram | undefined;
  readonly #tabBuilds = new Map<string, TabBuild>();

  get mode(): PreviewMode {
    return this.#mode;
  }

  get scene(): PreviewGeometryScene {
    return this.#scene;
  }

  get lastResult(): RuntimeResult {
    return this.#lastResult;
  }

  get currentLine(): number {
    return this.#currentLine;
  }

  get feedback(): EditorExecutionFeedback {
    return this.#feedback;
  }

  get program(): FunctionProgram | undefined {
    return this.#program;
  }

  get buildNumber(): number {
    return this.#buildNumber;
  }

  get previewDirty(): boolean {
    return this.#previewDirty;
  }

  get debugBlocked(): boolean {
    return this.#mode === 'build' && this.#codeDirty;
  }

  get previewStatus(): string {
    if (this.#mode === 'debug') return 'Debug · live preview';
    const errors = this.#feedback.diagnostics.length + (this.#feedback.externalDiagnostics?.length ?? 0);
    const pending = this.#codeDirty
      ? 'code changes pending — press Build'
      : 'parameter changes pending — press OK in Parameters';

    return `Build #${this.#buildNumber} · ${this.#previewDirty ? pending : errors ? `${errors} error(s)` : `${this.#scene.meshes.length} mesh(es)`}`;
  }

  setMode(mode: PreviewMode): void {
    this.#mode = mode;
  }

  markParametersChanged(): void {
    this.#previewDirty = true;
  }

  // Parameters are found before execution because the Parameter panel turns them into the
  // overrides that execute() receives.
  discoverParameters(
    program: FunctionProgram,
    isDeleted: (functionName: string) => boolean,
  ): RuntimeParameterRequest[] {
    this.#program = program;

    return this.runtime
      .discoverParameters(program.source, program.options)
      .filter((definition) => !definition.functionName || !isDeleted(definition.functionName));
  }

  execute(
    program: FunctionProgram,
    source: string,
    line: number,
    parameters: ReadonlyMap<string, string>,
  ): ExecutionOutcome {
    this.runtime.setParameters(parameters);
    let result: RuntimeResult;
    try {
      result = this.runtime.executeUpToLine(program.source, line, this.#mode === 'build', program.options);
    } catch (e) {
      this.#feedback = { source, diagnostics: [{ line, message: what(e) }] };

      return { error: what(e) };
    }
    const sourceLines = source.split('\n').length;
    this.#feedback = {
      source,
      diagnostics: result.diagnostics.filter((d) => d.line <= sourceLines),
      externalDiagnostics: result.diagnostics
        .filter((d) => d.line > sourceLines)
        .map((d) => {
          const location = program.locations.findLast((entry) => d.line >= entry.start && d.line <= entry.end);

          return {
            name: location?.name || 'Main',
            line: location ? d.line - location.start + location.localStart : d.line,
            sourceLine: d.line,
            message: d.message,
          };
        }),
    };
    this.#lastResult = result;
    this.#currentLine = line;
    this.#scene = this.#engine.build(result);

    return { result };
  }

  clear(source: string): void {
    this.#lastResult = emptyRuntimeResult();
    this.#scene = { meshes: [], warnings: [] };
    this.#feedback = { source, diagnostics: [] };
  }

  beginBuild(): void {
    this.#buildNumber = ++this.#buildSequence;
  }

  recordBuild(tab: string, source: string, program: FunctionProgram, parameters: ReadonlyMap<string, string>): void {
    this.#builtSource = source;
    this.#builtProgram = program;
    this.#tabBuilds.set(tab, { source, program, number: this.#buildNumber, parameters });
    this.#codeDirty = false;
    this.#previewDirty = false;
  }

  // programSource is only computed when there is a build to compare against.
  markEdited(source: string, programSource: () => string): void {
    this.#codeDirty =
      source !== this.#builtSource || (!!this.#builtProgram && programSource() !== this.#builtProgram.source);
    this.#previewDirty = true;
  }

  // Switching function tabs: take the tab's last Build as the reference for "code changed".
  restoreTab(tab: string, source: string, currentProgram: FunctionProgram): TabBuild | undefined {
    const built = this.#tabBuilds.get(tab);
    this.#builtSource = built?.source ?? null;
    this.#builtProgram = built?.program;
    this.#codeDirty = !!built && (source !== built.source || currentProgram.source !== built.program.source);
    this.#previewDirty = this.#codeDirty;

    return built;
  }

  showBuild(built: TabBuild): void {
    this.#buildNumber = built.number;
  }

  // After showing a tab's last Build: parameters or preview inputs changed since then are pending.
  markDriftSince(built: TabBuild, overrides: ReadonlyMap<string, string>, currentProgram: FunctionProgram): void {
    const current = [...overrides].sort(([a], [b]) => a.localeCompare(b));
    const previous = [...built.parameters].sort(([a], [b]) => a.localeCompare(b));
    this.#previewDirty ||= JSON.stringify(current) !== JSON.stringify(previous);
    this.#previewDirty ||=
      JSON.stringify([...(currentProgram.options.arguments ?? [])]) !==
      JSON.stringify([...(built.program.options.arguments ?? [])]);
  }

  forgetBuild(tab: string): void {
    this.#tabBuilds.delete(tab);
  }

  // A deleted function's tab build goes, and so do its parameter values in other tabs' builds.
  forgetFunction(name: string): void {
    this.#tabBuilds.delete(name);
    for (const built of this.#tabBuilds.values())
      built.parameters = new Map([...built.parameters].filter(([key]) => !isFunctionParameterKey(key, name)));
  }
}

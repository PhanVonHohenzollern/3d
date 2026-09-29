import { isFunctionParameterKey } from '@/entities/parameter';
import type { FunctionProgram } from '@/entities/source-function';
import type { EditorExecutionFeedback, PreviewMode } from '@/features/run-preview/model/types';
import type {
  AvailabilityRequest,
  AvailabilityResponse,
} from '@/features/run-preview/model/parameterAvailability.worker';
import { Signal } from '@/shared/lib/observable';
import { PreviewGeometryEngine, type PreviewGeometryScene } from '@engine/geometry';
import {
  emptyRuntimeResult,
  GeometryRuntime,
  parameterKey,
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

const kAvailabilityCacheSize = 32;

function lineCount(source: string): number {
  return source.split('\n').length;
}

function runKey(
  program: FunctionProgram,
  parameters: ReadonlyMap<string, string>,
  line: number,
  fullProgram: boolean,
): string {
  const entries = [...parameters].sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify([program.source, program.options, entries, line, fullProgram], (_, value: unknown) =>
    value instanceof Map ? [...value] : value,
  );
}

// Owns preview execution, editor feedback, and the Build cache per function tab.
export class PreviewSession {
  readonly parameterAvailabilityChanged = new Signal<[]>();
  #runtime = new GeometryRuntime();
  #spareRuntime = new GeometryRuntime();
  #spareRun: { key: string; result: RuntimeResult } | null = null;
  readonly #activeKeys = new Map<string, ReadonlySet<string> | null>();
  #availabilityWorker: Worker | undefined;
  #availabilityTimer: ReturnType<typeof setTimeout> | undefined;
  #availabilityRequest: { id: number; key: string } | undefined;
  #availabilitySequence = 0;
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

  // The runtime that produced the last preview; the Link evaluator and tests read its variables.
  get runtime(): GeometryRuntime {
    return this.#runtime;
  }

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
    if (this.#mode !== mode) this.#cancelAvailability();
    this.#mode = mode;
  }

  dispose(): void {
    this.#cancelAvailability();
    this.#availabilityWorker?.terminate();
    this.#availabilityWorker = undefined;
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

  // Build edits check availability off the UI thread. Debug can reuse the spare execution.
  activeParameterKeys(parameters: ReadonlyMap<string, string>): ReadonlySet<string> | null {
    const program = this.#program;
    if (!program) return null;
    const lines = lineCount(program.source);
    const key = runKey(program, parameters, lines, true);
    if (this.#activeKeys.has(key)) {
      this.#cancelAvailability();

      return this.#activeKeys.get(key) ?? null;
    }
    if (this.#mode === 'build') {
      this.#scheduleAvailability(program, parameters, key);

      return null;
    }
    this.#spareRuntime.setParameters(parameters);
    const result = this.#spareRuntime.executeUpToLine(program.source, lines, true, program.options);
    this.#spareRun = { key, result };

    return this.#rememberActiveKeys(key, result);
  }

  #rememberActiveKeys(key: string, result: RuntimeResult): ReadonlySet<string> {
    const keys = new Set(result.parameterRequests.map(parameterKey));
    if (this.#availabilityRequest?.key === key) this.#cancelAvailability();
    this.#cacheActiveKeys(key, keys);

    return keys;
  }

  #cacheActiveKeys(key: string, keys: ReadonlySet<string> | null): void {
    if (this.#activeKeys.size >= kAvailabilityCacheSize)
      this.#activeKeys.delete(this.#activeKeys.keys().next().value ?? '');
    this.#activeKeys.set(key, keys);
  }

  #cancelAvailability(): void {
    clearTimeout(this.#availabilityTimer);
    this.#availabilityTimer = undefined;
    this.#availabilityRequest = undefined;
  }

  #scheduleAvailability(program: FunctionProgram, parameters: ReadonlyMap<string, string>, key: string): void {
    if (this.#availabilityRequest?.key === key) return;
    this.#cancelAvailability();
    if (typeof Worker === 'undefined') return;
    const id = ++this.#availabilitySequence;
    this.#availabilityRequest = { id, key };
    const request: AvailabilityRequest = {
      id,
      source: program.source,
      options: program.options,
      parameters: new Map(parameters),
    };
    this.#availabilityTimer = setTimeout(() => {
      this.#availabilityTimer = undefined;
      try {
        if (!this.#availabilityWorker) {
          this.#availabilityWorker = new Worker(new URL('./parameterAvailability.worker.ts', import.meta.url), {
            type: 'module',
          });
          this.#availabilityWorker.onmessage = ({ data }: MessageEvent<AvailabilityResponse>) => {
            const pending = this.#availabilityRequest;
            if (!pending || data.id !== pending.id) return;
            this.#availabilityRequest = undefined;
            this.#cacheActiveKeys(pending.key, data.keys ? new Set(data.keys) : null);
            this.parameterAvailabilityChanged.emit();
          };
          this.#availabilityWorker.onerror = () => this.#availabilityFailed();
        }
        this.#availabilityWorker.postMessage(request);
      } catch {
        this.#availabilityFailed();
      }
    }, 150);
  }

  #availabilityFailed(): void {
    const pending = this.#availabilityRequest;
    this.#cancelAvailability();
    this.#availabilityWorker?.terminate();
    this.#availabilityWorker = undefined;
    if (pending) {
      this.#cacheActiveKeys(pending.key, null);
      this.parameterAvailabilityChanged.emit();
    }
  }

  execute(
    program: FunctionProgram,
    source: string,
    line: number,
    parameters: ReadonlyMap<string, string>,
  ): ExecutionOutcome {
    const fullProgram = this.#mode === 'build';
    const lines = lineCount(program.source);
    const effectiveLine = Math.min(Math.max(0, line), lines);
    const key = runKey(program, parameters, effectiveLine, fullProgram);
    let result: RuntimeResult;
    if (this.#spareRun?.key === key) {
      // A Build asks exactly what the availability check just ran: keep that run and its runtime.
      result = this.#spareRun.result;
      [this.#runtime, this.#spareRuntime] = [this.#spareRuntime, this.#runtime];
      this.#spareRun = null;
    } else {
      this.#runtime.setParameters(parameters);
      try {
        result = this.#runtime.executeUpToLine(program.source, line, fullProgram, program.options);
      } catch (e) {
        this.#feedback = { source, diagnostics: [{ line, message: what(e) }] };

        return { error: what(e) };
      }
      if (fullProgram && effectiveLine === lines) {
        this.#rememberActiveKeys(key, result);
        this.parameterAvailabilityChanged.emit();
      }
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

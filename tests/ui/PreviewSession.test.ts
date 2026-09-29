import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeometryRuntime } from '@engine/runtime';
import { FunctionWorkspace } from '@/entities/source-function';
import { PreviewSession } from '@/features/run-preview';
import { ParameterPanelModel } from '@/features/edit-parameters';
import type {
  AvailabilityRequest,
  AvailabilityResponse,
} from '@/features/run-preview/model/parameterAvailability.worker';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockAvailabilityWorker() {
  const worker = {
    postMessage: vi.fn<(request: AvailabilityRequest) => void>(),
    terminate: vi.fn(),
    onmessage: null as ((event: MessageEvent<AvailabilityResponse>) => void) | null,
    onerror: null as (() => void) | null,
    reply(id: number, keys: string[] | null) {
      this.onmessage?.({ data: { id, keys } } as MessageEvent<AvailabilityResponse>);
    },
  };
  vi.stubGlobal(
    'Worker',
    vi.fn(function () {
      return worker;
    }),
  );

  return worker;
}

const kSource = [
  'double w = 2;',
  'get_val("Width", w);',
  'FdPoint3d p0(0, 0, 0);',
  'makeDisc(p0, vz, w, 1, 8, false);',
].join('\n');

function programFor(source: string) {
  const workspace = new FunctionWorkspace();
  workspace.edit(source);

  return workspace.program(source);
}

describe('PreviewSession', () => {
  it('discovers parameters, then executes with the given overrides and builds the scene', () => {
    const session = new PreviewSession();
    const program = programFor(kSource);
    const definitions = session.discoverParameters(program, () => false);
    expect(definitions.map((definition) => definition.name)).toEqual(['Width']);
    expect(session.program).toBe(program);

    const outcome = session.execute(program, kSource, 4, new Map([['Width', '5']]));
    expect('result' in outcome && outcome.result.diagnostics).toEqual([]);
    expect(session.lastResult.apiCalls.map((call) => call.name)).toEqual(['makeDisc']);
    expect(session.scene.meshes).toHaveLength(1);
    expect(session.currentLine).toBe(4);
    expect(session.feedback).toEqual({ source: kSource, diagnostics: [], externalDiagnostics: [] });
    expect(session.runtime.evaluateNumericExpression('w')).toBe(5);
  });

  it('tracks Build numbers and blocks Debug after a code edit until the next Build', () => {
    const session = new PreviewSession();
    const program = programFor(kSource);
    session.setMode('build');
    session.beginBuild();
    session.execute(program, kSource, 4, new Map());
    session.recordBuild('', kSource, program, new Map());
    expect(session.previewStatus).toBe('Build #1 · 1 mesh(es)');
    expect(session.debugBlocked).toBe(false);

    session.markEdited(kSource + '\n', () => programFor(kSource + '\n').source);
    expect(session.debugBlocked).toBe(true);
    expect(session.previewStatus).toBe('Build #1 · code changes pending — press Build');

    session.markEdited(kSource, () => program.source);
    session.markParametersChanged();
    expect(session.debugBlocked).toBe(false);
    expect(session.previewStatus).toBe('Build #1 · parameter changes pending — press OK in Parameters');
  });

  it('restores a tab build and drops a deleted function from the other builds', () => {
    const session = new PreviewSession();
    const program = programFor(kSource);
    session.beginBuild();
    session.recordBuild(
      '',
      kSource,
      program,
      new Map([
        ['Width', '3'],
        ['helper::D', '9'],
      ]),
    );
    session.recordBuild('helper', 'void helper() {}', programFor('void helper() {}'), new Map());

    session.forgetFunction('helper');
    expect(session.restoreTab('helper', 'void helper() {}', program)).toBeUndefined();
    const main = session.restoreTab('', kSource, program);
    expect([...(main?.parameters ?? [])]).toEqual([['Width', '3']]);
    expect(session.previewDirty).toBe(false);

    session.markDriftSince(main!, new Map([['Width', '4']]), program);
    expect(session.previewDirty).toBe(true);
  });

  it('runs only on Build and reuses its parameter availability while edits stay nonblocking', () => {
    const session = new PreviewSession();
    const program = programFor(kSource);
    session.setMode('build');
    session.discoverParameters(program, () => false);
    const runs = vi.spyOn(GeometryRuntime.prototype, 'executeUpToLine');
    try {
      const parameters = new Map([['Width', '5']]);
      expect(session.activeParameterKeys(parameters)).toBeNull();
      expect(session.activeParameterKeys(parameters)).toBeNull();
      expect(runs).not.toHaveBeenCalled();
      session.execute(program, kSource, kSource.split('\n').length, parameters);
      expect(runs).toHaveBeenCalledTimes(1);
      expect(session.runtime.evaluateNumericExpression('w')).toBe(5);
      expect(session.scene.meshes).toHaveLength(1);
      expect(session.activeParameterKeys(parameters)).toEqual(new Set(['Width']));

      session.activeParameterKeys(new Map([['Width', '6']]));
      expect(runs).toHaveBeenCalledTimes(1);
    } finally {
      runs.mockRestore();
    }
  });

  it('checks committed Build edits in a worker and keeps an input draft when availability arrives', () => {
    vi.useFakeTimers();
    const worker = mockAvailabilityWorker();
    const session = new PreviewSession();
    session.setMode('build');
    const source = `double mode=0; get_val("Mode",mode);
if(mode==1) { double w=5; get_val("Width",w); }
else { double h=8; get_val("Height",h); }`;
    const program = programFor(source);
    const model = new ParameterPanelModel();
    model.setAvailability((parameters) => session.activeParameterKeys(parameters));
    session.parameterAvailabilityChanged.connect(() => model.refreshAvailability());
    const runs = vi.spyOn(GeometryRuntime.prototype, 'executeUpToLine');
    model.setDefinitions(session.discoverParameters(program, () => false));
    model.edit(0, 3);
    model.editorTextEdited('1');
    model.commitEditor();
    expect(runs).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const request = worker.postMessage.mock.calls[0][0];
    expect(request.parameters.get('Mode')).toBe('1');
    model.edit(1, 3);
    model.editorTextEdited('42');
    worker.reply(request.id, ['Mode', 'Width']);
    expect(model.rows.map((r) => r.disabled)).toEqual([false, false, true]);
    expect(model.editor?.text).toBe('42');
    expect(runs).not.toHaveBeenCalled();
    model.commitEditor();
    expect(model.overrides().get('Width')).toBe('42');
    session.dispose();
    vi.runAllTimers();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('ignores stale availability after newer edits, a tab change, or a completed Build', () => {
    vi.useFakeTimers();
    const worker = mockAvailabilityWorker();
    const session = new PreviewSession();
    session.setMode('build');
    const program = programFor(kSource);
    session.discoverParameters(program, () => false);
    const changed = vi.fn();
    session.parameterAvailabilityChanged.connect(changed);
    session.activeParameterKeys(new Map([['Width', '5']]));
    vi.advanceTimersByTime(150);
    const first = worker.postMessage.mock.calls[0][0];
    const parameters = new Map([['Width', '6']]);
    session.activeParameterKeys(parameters);
    vi.advanceTimersByTime(150);
    const second = worker.postMessage.mock.calls[1][0];
    worker.reply(first.id, ['old']);
    expect(changed).not.toHaveBeenCalled();
    session.execute(program, kSource, 4, parameters);
    changed.mockClear();
    worker.reply(second.id, ['old']);
    expect(changed).not.toHaveBeenCalled();
    expect(session.activeParameterKeys(parameters)).toEqual(new Set(['Width']));
    session.activeParameterKeys(new Map([['Width', '7']]));
    vi.advanceTimersByTime(150);
    const third = worker.postMessage.mock.calls[2][0];
    session.discoverParameters(programFor('double d=3; get_val("D",d);'), () => false);
    session.activeParameterKeys(new Map());
    worker.reply(third.id, ['Width']);
    expect(changed).not.toHaveBeenCalled();
    session.dispose();
  });

  it('keeps inputs editable if the worker fails and still allows an explicit Build', () => {
    vi.useFakeTimers();
    const worker = mockAvailabilityWorker();
    const session = new PreviewSession();
    session.setMode('build');
    const program = programFor(kSource);
    session.discoverParameters(program, () => false);
    const parameters = new Map([['Width', '6']]);
    session.activeParameterKeys(parameters);
    vi.advanceTimersByTime(150);
    worker.onerror?.();
    expect(session.activeParameterKeys(parameters)).toBeNull();
    vi.runAllTimers();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    session.execute(program, kSource, 4, parameters);
    expect(session.scene.meshes).toHaveLength(1);
    expect(session.activeParameterKeys(parameters)).toEqual(new Set(['Width']));
    session.dispose();
  });
});

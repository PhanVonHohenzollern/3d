import { describe, expect, it } from 'vitest';
import { FunctionWorkspace } from '@/entities/source-function';
import { PreviewSession } from '@/features/run-preview';

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
});

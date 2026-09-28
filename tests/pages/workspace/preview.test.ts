import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeometryRuntime } from '@engine/runtime';
import { createWorkspace, kSource } from '@tests/pages/workspace/harness';

describe('Workspace: Build and Debug preview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Build runs the main element before its helpers and locks inactive helper parameters immediately', () => {
    const { mw, editor, parameters } = createWorkspace();
    const source = [
      'short makeDV() {',
      ' double D=100, BG=1; get_val("D", D); get_val("BG", BG);',
      ' makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), D, 8);',
      ' if(BG) makeBG();',
      '}',
      'double makeBG() { double D=20; get_val("D", D); makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,30), D, 8); return 30; }',
    ].join('\n');
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(parameters.values().get('makeDV::BG')).toBe('0');
    expect(parameters.rows.find((row) => row.key === 'makeBG::D')?.disabled).toBe(true);
    expect(mw.session.lastResult.parameterRequests.map((p) => p.functionName)).toEqual(['makeDV', 'makeDV']);
    parameters.setCheckbox('makeDV::BG', true);
    mw.applyParameters();
    expect(mw.session.scene.meshes).toHaveLength(2);
    expect(mw.session.lastResult.parameterRequests.map((p) => p.functionName)).toEqual(['makeDV', 'makeDV', 'makeBG']);
    const built = mw.session.scene;
    parameters.setCheckbox('makeDV::BG', false);
    expect(parameters.rows.find((row) => row.key === 'makeBG::D')?.disabled).toBe(true);
    expect(mw.session.scene).toBe(built);
    mw.buildPreview();
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls.some((call) => call.name === 'makeBG')).toBe(false);
    mw.dispose();
  });

  it('builds the outer insulation mesh only when enabled and applies thickness on the next Build', () => {
    const { mw, editor, parameters } = createWorkspace();
    const source = [
      'double diameter = 100;',
      'get_val("diameter", diameter);',
      'double size;',
      'FdPoint3d p0(0, 0, 0), p1(0, 0, 100);',
      'makeVerySimpleTube(p0, p1, diameter, 8);',
      'if (getExtInsSize(size)) {',
      '  setPrimitiveMode(FLM3Geo::pmExtInsulation);',
      '  makeVerySimpleTube(p0, p1, diameter + 2 * size, 8);',
      '}',
    ].join('\n');
    mw.start();
    editor.type(source, 1);
    vi.advanceTimersByTime(220);
    expect(parameters.rows.map((row) => row.texts[0])).toEqual(['diameter', 'getExtInsSize', 'size']);
    mw.buildPreview();
    expect(mw.session.scene.meshes).toHaveLength(1);
    const scene = mw.session.scene;
    parameters.setInsulationEnabled('getExtInsSize', true);
    const sizeRow = parameters.rows.findIndex((row) => row.key === 'getExtInsSize');
    parameters.edit(sizeRow, 3);
    parameters.editorTextEdited('25');
    parameters.commitEditor();
    expect(mw.session.scene).toBe(scene);
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.meshes).toHaveLength(2);
    expect(mw.session.scene.meshes[1].color).toEqual({ r: Math.fround(139 / 255), g: 0, b: 0 });
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(25);
    const outerCall = mw.session.lastResult.apiCalls.findLast((call) => call.name === 'makeVerySimpleTube');
    expect(outerCall?.arguments[2]).toBe(150);
    parameters.setInsulationEnabled('getExtInsSize', false);
    expect(mw.session.scene.meshes).toHaveLength(2);
    mw.buildPreview();
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(parameters.rows[sizeRow].disabled).toBe(true);
    mw.dispose();
  });

  it('blocks Debug after code edits in Build mode until the next Build', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    mw.buildPreview();
    expect(mw.session.debugBlocked).toBe(false);
    // Moving the cursor or editing a parameter does not count as a code edit.
    editor.moveTo(3);
    parameters.edit(0, 3);
    parameters.editorTextEdited('8');
    parameters.commitEditor();
    expect(mw.session.debugBlocked).toBe(false);
    editor.type(kSource.replace('double after = 1', 'double after = 9'), 3);
    const builtScene = mw.session.scene;
    const builtResult = mw.session.lastResult;
    expect(mw.session.debugBlocked).toBe(true);
    mw.debugPreview();
    vi.advanceTimersByTime(1000);
    expect(mw.session.mode).toBe('build');
    expect(mw.session.scene).toBe(builtScene);
    expect(mw.session.lastResult).toBe(builtResult);
    mw.buildPreview();
    expect(mw.session.debugBlocked).toBe(false);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(9);
    mw.debugPreview();
    expect(mw.session.mode).toBe('debug');
    expect(mw.session.currentLine).toBe(3);
    mw.dispose();
  });

  it('recognizes when an edit is undone back to the built source', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    mw.buildPreview();
    editor.type(kSource + '\n// draft', 1);
    expect(mw.session.debugBlocked).toBe(true);
    editor.type(kSource, 1);
    expect(mw.session.debugBlocked).toBe(false);
    mw.dispose();
  });

  it('rebuilds computed source defaults and commits a pending parameter edit', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource.replace('double w = 2;', 'double w = 2 * 3;'), 1);
    mw.buildPreview();
    const firstObj = mw.exportObj();
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(6);
    expect(parameters.values().get('Width')).toBe('6');
    expect(mw.session.previewStatus).toContain('Build #1');
    editor.type(kSource.replace('double w = 2;', 'double w = 4 * 3;'), 1);
    expect(mw.session.previewStatus).toContain('changes pending');
    expect(mw.exportObj()).toBe(firstObj);
    mw.buildPreview();
    expect(mw.session.buildNumber).toBe(2);
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(12);
    expect(mw.exportObj()).not.toBe(firstObj);
    parameters.edit(0, 3);
    parameters.editorTextEdited('18');
    mw.buildPreview();
    expect(parameters.editor).toBeNull();
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(18);
    expect(mw.session.previewDirty).toBe(false);
    mw.dispose();
  });

  it('OK applies a pending string get_val and clears character arithmetic errors without another Build', () => {
    const { mw, editor, parameters } = createWorkspace();
    const source = [
      'double Da, Di, H, Lk;',
      'char* zxd;',
      'get_val("Da_ASS", Da);',
      'get_val("Di_ASS", Di);',
      'get_val("h_ASS", H);',
      'get_val("LK_ASS", Lk);',
      'get_val("zxd_ASS", zxd);',
      "double n = zxd[0] - '0';",
      "double d = zxd[2] - '0';",
      'makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), d, n);',
    ].join('\n');
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.session.feedback.diagnostics.length).toBeGreaterThan(0);
    const row = parameters.rows.findIndex((item) => item.key === 'zxd_ASS');
    parameters.edit(row, 3);
    parameters.editorTextEdited('6x8');
    mw.applyParameters();
    expect(parameters.editor).toBeNull();
    expect(mw.session.feedback.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('n')).toBe(6);
    expect(mw.session.runtime.evaluateNumericExpression('d')).toBe(8);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.buildNumber).toBe(2);
    expect(mw.session.mode).toBe('build');
    expect(mw.session.previewDirty).toBe(false);
    mw.dispose();
  });

  it('OK builds the current code with the selected parameter row and unlocks Debug', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    const previousObj = mw.exportObj();
    parameters.importTable('Width\n8\n12');
    parameters.selectDataSet(1);
    expect(mw.session.previewStatus).toContain('press OK in Parameters');
    expect(mw.exportObj()).toBe(previousObj);
    editor.type(kSource.replace('double after = 1', 'double after = 9'), 2);
    mw.applyParameters();
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(12);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(9);
    expect(mw.exportObj()).not.toBe(previousObj);
    expect(mw.session.feedback.source).toBe(editor.text);
    expect(mw.session.buildNumber).toBe(2);
    expect(mw.session.debugBlocked).toBe(false);
    expect(mw.session.previewDirty).toBe(false);
    expect(mw.session.mode).toBe('build');
    mw.debugPreview();
    expect(mw.session.mode).toBe('debug');
    mw.dispose();
  });

  it('OK builds the full code from Debug and commits a pending parameter edit', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource, 5);
    vi.advanceTimersByTime(220);
    parameters.edit(0, 3);
    parameters.editorTextEdited('10');
    mw.applyParameters();
    expect(parameters.editor).toBeNull();
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(10);
    expect(mw.session.currentLine).toBe(6);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(1);
    expect(mw.session.mode).toBe('build');
    expect(mw.session.buildNumber).toBe(1);
    expect(mw.session.scene.meshes).toHaveLength(1);
    mw.dispose();
  });

  it('Build uses the complete normalized source even if editor block count differs', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    vi.spyOn(editor, 'blockCount').mockReturnValue(1);
    mw.buildPreview();
    expect(mw.session.currentLine).toBe(6);
    expect(mw.session.scene.meshes).toHaveLength(1);
    mw.dispose();
  });

  it('publishes runtime errors for the source that was executed and clears them after repair', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type('double width = 5;\nwidth = missingValue;\n', 1);
    mw.buildPreview();
    expect(mw.session.feedback.source).toBe(editor.text);
    expect(mw.session.feedback.diagnostics).toContainEqual({ line: 2, message: 'unknown variable: missingValue' });
    const built = mw.session.lastResult;
    editor.type('double width = 5;\nwidth = 12;\n', 1);
    expect(mw.session.lastResult).toBe(built);
    mw.buildPreview();
    expect(mw.session.feedback.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('width')).toBe(12);
    mw.dispose();
  });

  it('runs the program once per Build, including the Parameter panel availability check', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    const runs = vi.spyOn(GeometryRuntime.prototype, 'executeUpToLine');
    try {
      mw.buildPreview();
      expect(runs).toHaveBeenCalledTimes(1);
      expect(mw.session.scene.meshes).toHaveLength(1);
      expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(1);
    } finally {
      runs.mockRestore();
    }
    mw.dispose();
  });

  it('builds the whole source and freezes geometry and runtime state until the next build', () => {
    const { mw, editor, log, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    expect(mw.session.mode).toBe('build');
    expect(mw.session.currentLine).toBe(6);
    expect(editor.currentLine()).toBe(1);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(1);
    const builtScene = mw.session.scene;
    const builtResult = mw.session.lastResult;
    const exported = mw.exportObj();

    log.length = 0;
    editor.type(kSource.replace('double after = 1', 'double after = 9'), 3);
    editor.moveTo(4);
    parameters.edit(0, 3);
    parameters.editorTextEdited('7');
    parameters.commitEditor();
    vi.advanceTimersByTime(1000);
    expect(mw.session.scene).toBe(builtScene);
    expect(mw.session.lastResult).toBe(builtResult);
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(2);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(1);
    expect(mw.exportObj()).toBe(exported);
    expect(log).toEqual([]);

    mw.buildPreview();
    expect(mw.session.scene).not.toBe(builtScene);
    expect(mw.session.currentLine).toBe(6);
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(7);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(9);
    expect(mw.exportObj()).not.toBe(exported);
    mw.dispose();
  });

  it('switches from a focused build to Debug at the cursor and resumes live updates', () => {
    const { mw, editor, apiTrace, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    apiTrace.selectMeshApiCall(0);
    mw.selection.onApiTraceSourceActivated(5);
    expect(mw.selection.browsingTrace).toBe(true);

    mw.debugPreview();
    expect(mw.session.mode).toBe('debug');
    expect(mw.selection.browsingTrace).toBe(false);
    expect(mw.session.currentLine).toBe(5);
    expect(apiTrace.selectedApiCall()).toBe(-1);
    expect(mw.session.lastResult.variables.some((v) => v.name === 'after')).toBe(false);

    editor.moveTo(3);
    vi.advanceTimersByTime(220);
    expect(mw.session.currentLine).toBe(3);
    expect(mw.session.scene.meshes).toHaveLength(0);
    editor.type(kSource.replace('double after = 1', 'double after = 4'), 6);
    vi.advanceTimersByTime(220);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(4);
    parameters.edit(0, 3);
    parameters.editorTextEdited('9');
    parameters.commitEditor();
    expect(mw.session.runtime.evaluateNumericExpression('w')).toBe(9);
    mw.dispose();
  });

  it('starts like the Qt constructor and debounces edits by 220 ms', () => {
    const { mw, log, editor, variables } = createWorkspace();
    mw.start();
    expect(mw.statusBar().currentMessage()).toBe('Geometry Preview ready');
    expect(log.slice(0, 2)).toEqual(['setSelectedApiCall(-1, false)', 'clearApiFocus()']);

    log.length = 0;
    editor.type(kSource, 6);
    vi.advanceTimersByTime(219);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log.indexOf('setGeometryScene(obj)')).toBeLessThan(log.indexOf('setRuntimeResult(obj)'));
    expect(log.indexOf('setRuntimeResult(obj)')).toBeLessThan(log.indexOf('setConnectorPreviews([0], -1)'));
    expect(mw.session.currentLine).toBe(6);
    expect(variables.summary).toMatch(/^State after line 6 {2}\| {2}\d+ variable\(s\)/);
    expect(mw.statusBar().currentMessage()).toMatch(/^Line 6 \| 1 live mesh\(es\) \| 1 API call\(s\)$/);
    vi.advanceTimersByTime(2600);
    expect(mw.statusBar().currentMessage()).toBe('');
    mw.dispose();
  });

  it('discovers get_val parameters from the whole source, independent of the cursor', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    vi.advanceTimersByTime(220);
    expect(mw.session.currentLine).toBe(1);
    expect(parameters.rows.map((row) => row.texts[0])).toEqual(['Width']);
    expect(mw.session.lastResult.apiCalls).toHaveLength(0);
    mw.dispose();
  });
});

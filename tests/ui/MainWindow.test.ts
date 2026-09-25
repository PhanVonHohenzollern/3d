import { parseObj, writeObj } from '../../src/core/formats/obj';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTracePanelModel } from '../../src/hooks/apiTrace/ApiTracePanelModel';
import { LinkPanelModel } from '../../src/hooks/linkPanel/LinkPanelModel';
import { MainWindow } from '../../src/hooks/mainWindow/MainWindow';
import { ParameterPanelModel } from '../../src/hooks/parameterPanel/ParameterPanelModel';
import { VariablePanelModel } from '../../src/hooks/variablePanel/VariablePanelModel';
import type { CodeEditorHandle } from '../../src/types/editor';
import type { Viewport3DHandle } from '../../src/types/viewport';
import { createViewport3DHandle } from '../../src/helpers/viewportHandle';
import { QVector3D } from '../../src/utils/Vector3D';
import { boxMesh, click, createEngine, project, scene } from '../renderer/helpers';

class FakeEditor implements CodeEditorHandle {
  text = '';
  cursor = 0;
  traceLines: { lines: number[]; active: number } = { lines: [], active: -1 };
  focused = false;
  onTextChanged: () => void = () => {};
  onCursorPositionChanged: () => void = () => {};

  #lineStart(line: number): number {
    let position = 0;
    for (let i = 1; i < line; ++i) position = this.text.indexOf('\n', position) + 1;

    return position;
  }

  #setCursor(position: number): void {
    const moved = position !== this.cursor;
    this.cursor = position;
    if (moved) this.onCursorPositionChanged();
  }

  type(text: string, cursorLine: number): void {
    this.text = text;
    this.onTextChanged();
    this.#setCursor(this.#lineStart(cursorLine));
  }

  moveTo(line: number): void {
    this.#setCursor(this.#lineStart(line));
  }

  toPlainText() {
    return this.text;
  }

  clear() {
    this.text = '';
    this.cursor = 0;
    this.onTextChanged();
    this.onCursorPositionChanged();
  }

  currentLine() {
    return this.text.slice(0, this.cursor).split('\n').length;
  }

  blockCount() {
    return this.text.split('\n').length;
  }

  setTraceSourceLines(lines: ReadonlySet<number>, activeLine = -1) {
    this.traceLines = { lines: [...lines].sort((a, b) => a - b), active: activeLine };
  }

  setTextCursorToLine(line: number) {
    this.#setCursor(this.#lineStart(line));
  }

  centerCursor() {}

  cursorBlockText() {
    return this.text.split('\n')[this.currentLine() - 1];
  }

  insertAtCursorBlockEnd(text: string) {
    const start = this.#lineStart(this.currentLine());
    const end = start + this.cursorBlockText().length;
    this.text = this.text.slice(0, end) + text + this.text.slice(end);
    this.onTextChanged();
    this.#setCursor(end + text.length);
  }

  setFocus() {
    this.focused = true;
  }
}

function fakeViewport(log: string[]): Viewport3DHandle {
  let apiFocus = false;

  const record =
    (name: string) =>
    (...args: unknown[]) => {
      const printable = args.map((a) =>
        a instanceof Set
          ? `{${[...a].join(',')}}`
          : Array.isArray(a)
            ? `[${a.length}]`
            : typeof a === 'object'
              ? 'obj'
              : String(a),
      );
      log.push(`${name}(${printable.join(', ')})`);
    };

  return {
    setRuntimeResult: record('setRuntimeResult'),
    setShowPoints: record('setShowPoints'),
    setShowVectors: record('setShowVectors'),
    setShowLabels: record('setShowLabels'),
    setDebugItemVisible: record('setDebugItemVisible'),
    hideAllDebugItems: record('hideAllDebugItems'),
    showAllDebugItems: record('showAllDebugItems'),
    setSelectedVariable: record('setSelectedVariable'),
    setSelectedVariables: record('setSelectedVariables'),
    selectedDebugItems: () => new Set<string>(),
    fitDebugOverlay: record('fitDebugOverlay'),
    setGeometryScene: record('setGeometryScene'),
    setShowGeometry: record('setShowGeometry'),
    setGeometryWireframe: record('setGeometryWireframe'),
    setSelectedApiCall: record('setSelectedApiCall'),
    selectedMeshIndex: () => -1,
    isMeshSelected: () => false,
    hasApiFocus: () => apiFocus,
    hasMeshFocus: () => false,
    setApiFocusIndices: (indices) => {
      apiFocus = true;
      record('setApiFocusIndices')(indices);
    },
    clearApiFocus: () => {
      apiFocus = false;
      record('clearApiFocus')();
    },
    fitScene: record('fitScene'),
    setConnectorPreviews: record('setConnectorPreviews'),
  };
}

function createMainWindow() {
  const mw = new MainWindow();
  const log: string[] = [];
  const editor = new FakeEditor();
  const variables = new VariablePanelModel();
  const parameters = new ParameterPanelModel();
  const apiTrace = new ApiTracePanelModel();
  const links = new LinkPanelModel();
  const viewport = fakeViewport(log);
  mw.bindEditor(editor);
  mw.bindViewport(viewport);
  mw.bindVariables(variables);
  mw.bindParameters(parameters);
  mw.bindApiTrace(apiTrace);
  mw.bindLinks(links);
  editor.onTextChanged = mw.onEditorTextChanged;
  editor.onCursorPositionChanged = mw.onEditorCursorPositionChanged;
  variables.setSelectionChangedCallback(mw.onVariableSelectionChanged);
  parameters.setChangedCallback(mw.onParametersChanged);
  apiTrace.setSelectionChangedCallback(mw.onApiTraceSelectionChanged);
  apiTrace.setSourceActivatedCallback(mw.onApiTraceSourceActivated);
  apiTrace.setHistorySourceActivatedCallback(mw.onApiTraceHistorySourceActivated);
  links.setExpressionEvaluator(mw.linkExpressionEvaluator);
  links.setPreviewChangedCallback(mw.onLinkPreviewChanged);

  return { mw, log, editor, variables, parameters, apiTrace, links };
}

const kSource = [
  'double w = 2;',
  'get_val("Width", w);',
  'FdPoint3d p0(1, 2, 3);',
  'FdVector3d n(0, 0, 1);',
  'makeDisc(p0, n, w, 1, 8, false);',
  'double after = 1;',
].join('\n');

const isMac = /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || '');

function keyEvent(
  key: string,
  modifiers: { control?: boolean; shift?: boolean } = {},
  target: 'input' | 'tree' | 'dialog' = 'tree',
) {
  const matches: Record<string, string> = { input: 'input', tree: '.tree-view', dialog: '[data-floating-window]' };

  return {
    key,
    shiftKey: !!modifiers.shift,
    ctrlKey: !isMac && !!modifiers.control,
    metaKey: isMac && !!modifiers.control,
    altKey: false,
    target: { closest: (selectors: string) => (selectors.includes(matches[target]) ? {} : null) },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe('MainWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Build runs the main element before its helpers and locks inactive helper parameters immediately', () => {
    const { mw, editor, parameters } = createMainWindow();
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
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_geometryScene.meshes).toHaveLength(2);
    expect(mw.m_lastResult.parameterRequests.map((p) => p.functionName)).toEqual(['makeDV', 'makeDV', 'makeBG']);
    const built = mw.m_geometryScene;
    parameters.setCheckbox('makeDV::BG', false);
    expect(parameters.rows.find((row) => row.key === 'makeBG::D')?.disabled).toBe(true);
    expect(mw.m_geometryScene).toBe(built);
    mw.buildPreview();
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls.some((call) => call.name === 'makeBG')).toBe(false);
    mw.dispose();
  });

  it('builds the outer insulation mesh only when enabled and applies thickness on the next Build', () => {
    const { mw, editor, parameters } = createMainWindow();
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
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    const scene = mw.m_geometryScene;
    parameters.setExtInsulationEnabled(true);
    const sizeRow = parameters.rows.findIndex((row) => row.key === 'getExtInsSize');
    parameters.edit(sizeRow, 3);
    parameters.editorTextEdited('25');
    parameters.commitEditor();
    expect(mw.m_geometryScene).toBe(scene);
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_geometryScene.meshes).toHaveLength(2);
    expect(mw.m_geometryScene.meshes[1].color).toEqual({ r: Math.fround(139 / 255), g: 0, b: 0 });
    expect(mw.m_runtime.evaluateNumericExpression('size')).toBe(25);
    const outerCall = mw.m_lastResult.apiCalls.findLast((call) => call.name === 'makeVerySimpleTube');
    expect(outerCall?.arguments[2]).toBe(150);
    parameters.setExtInsulationEnabled(false);
    expect(mw.m_geometryScene.meshes).toHaveLength(2);
    mw.buildPreview();
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(parameters.rows[sizeRow].disabled).toBe(true);
    mw.dispose();
  });

  it('blocks Debug after code edits in Build mode until the next Build', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    mw.buildPreview();
    expect(mw.debugBlocked).toBe(false);
    // Moving the cursor or editing a parameter does not count as a code edit.
    editor.moveTo(3);
    parameters.edit(0, 3);
    parameters.editorTextEdited('8');
    parameters.commitEditor();
    expect(mw.debugBlocked).toBe(false);
    editor.type(kSource.replace('double after = 1', 'double after = 9'), 3);
    const builtScene = mw.m_geometryScene;
    const builtResult = mw.m_lastResult;
    expect(mw.debugBlocked).toBe(true);
    mw.debugPreview();
    vi.advanceTimersByTime(1000);
    expect(mw.previewMode).toBe('build');
    expect(mw.m_geometryScene).toBe(builtScene);
    expect(mw.m_lastResult).toBe(builtResult);
    mw.buildPreview();
    expect(mw.debugBlocked).toBe(false);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(9);
    mw.debugPreview();
    expect(mw.previewMode).toBe('debug');
    expect(mw.m_currentPreviewLine).toBe(3);
    mw.dispose();
  });

  it('recognizes when an edit is undone back to the built source', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    mw.buildPreview();
    editor.type(kSource + '\n// draft', 1);
    expect(mw.debugBlocked).toBe(true);
    editor.type(kSource, 1);
    expect(mw.debugBlocked).toBe(false);
    mw.dispose();
  });

  it('rebuilds computed source defaults and commits a pending parameter edit', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource.replace('double w = 2;', 'double w = 2 * 3;'), 1);
    mw.buildPreview();
    const firstObj = mw.exportObj();
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(6);
    expect(parameters.values().get('Width')).toBe('6');
    expect(mw.previewStatus).toContain('Build #1');
    editor.type(kSource.replace('double w = 2;', 'double w = 4 * 3;'), 1);
    expect(mw.previewStatus).toContain('changes pending');
    expect(mw.exportObj()).toBe(firstObj);
    mw.buildPreview();
    expect(mw.buildNumber).toBe(2);
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(12);
    expect(mw.exportObj()).not.toBe(firstObj);
    parameters.edit(0, 3);
    parameters.editorTextEdited('18');
    mw.buildPreview();
    expect(parameters.editor).toBeNull();
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(18);
    expect(mw.previewDirty).toBe(false);
    mw.dispose();
  });

  it('Build uses the complete normalized source even if editor block count differs', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    vi.spyOn(editor, 'blockCount').mockReturnValue(1);
    mw.buildPreview();
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    mw.dispose();
  });

  it('publishes runtime errors for the source that was executed and clears them after repair', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type('double width = 5;\nwidth = missingValue;\n', 1);
    mw.buildPreview();
    expect(mw.executionFeedback.source).toBe(editor.text);
    expect(mw.executionFeedback.diagnostics).toContainEqual({ line: 2, message: 'unknown variable: missingValue' });
    const built = mw.m_lastResult;
    editor.type('double width = 5;\nwidth = 12;\n', 1);
    expect(mw.m_lastResult).toBe(built);
    mw.buildPreview();
    expect(mw.executionFeedback.diagnostics).toEqual([]);
    expect(mw.m_runtime.evaluateNumericExpression('width')).toBe(12);
    mw.dispose();
  });

  it('builds the whole source and freezes geometry and runtime state until the next build', () => {
    const { mw, editor, log, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    expect(mw.previewMode).toBe('build');
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(editor.currentLine()).toBe(1);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(1);
    const builtScene = mw.m_geometryScene;
    const builtResult = mw.m_lastResult;
    const exported = mw.exportObj();

    log.length = 0;
    editor.type(kSource.replace('double after = 1', 'double after = 9'), 3);
    editor.moveTo(4);
    parameters.edit(0, 3);
    parameters.editorTextEdited('7');
    parameters.commitEditor();
    vi.advanceTimersByTime(1000);
    expect(mw.m_geometryScene).toBe(builtScene);
    expect(mw.m_lastResult).toBe(builtResult);
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(2);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(1);
    expect(mw.exportObj()).toBe(exported);
    expect(log).toEqual([]);

    mw.buildPreview();
    expect(mw.m_geometryScene).not.toBe(builtScene);
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(7);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(9);
    expect(mw.exportObj()).not.toBe(exported);
    mw.dispose();
  });

  it('switches from a focused build to Debug at the cursor and resumes live updates', () => {
    const { mw, editor, apiTrace, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    apiTrace.selectMeshApiCall(0);
    mw.onApiTraceSourceActivated(5);
    expect(mw.m_browsingTrace).toBe(true);

    mw.debugPreview();
    expect(mw.previewMode).toBe('debug');
    expect(mw.m_browsingTrace).toBe(false);
    expect(mw.m_currentPreviewLine).toBe(5);
    expect(apiTrace.selectedApiCall()).toBe(-1);
    expect(mw.m_lastResult.variables.some((v) => v.name === 'after')).toBe(false);

    editor.moveTo(3);
    vi.advanceTimersByTime(220);
    expect(mw.m_currentPreviewLine).toBe(3);
    expect(mw.m_geometryScene.meshes).toHaveLength(0);
    editor.type(kSource.replace('double after = 1', 'double after = 4'), 6);
    vi.advanceTimersByTime(220);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(4);
    parameters.edit(0, 3);
    parameters.editorTextEdited('9');
    parameters.commitEditor();
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(9);
    mw.dispose();
  });

  it('restores the last build after OBJ import and rebuilds explicitly with Ctrl+R', () => {
    const { mw, editor, log } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    const builtScene = mw.m_geometryScene;
    const builtResult = mw.m_lastResult;
    const exported = mw.exportObj();
    mw.replacePreviewWithObj(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'), 'triangle.obj');
    editor.type(kSource.replace('double after = 1', 'double after = 8'), 1);
    mw.returnToCodePreview();
    expect(mw.importedObj).toBeNull();
    expect(mw.m_geometryScene).toBe(builtScene);
    expect(mw.m_lastResult).toBe(builtResult);
    expect(mw.exportObj()).toBe(exported);
    expect(log).toContain('setGeometryScene(obj)');
    expect(log).toContain('setRuntimeResult(obj)');

    const event = keyEvent('r', { control: true }, 'input');
    mw.handleKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mw.previewMode).toBe('build');
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(8);
    mw.dispose();
  });

  it.each(['build', 'debug'] as const)('%s explicitly switches an imported OBJ back to the editor preview', (mode) => {
    const { mw, editor, log } = createMainWindow();
    mw.start();
    editor.type(kSource, 3);
    mw.replacePreviewWithObj(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'), 'triangle.obj');
    log.length = 0;
    if (mode === 'build') mw.buildPreview();
    else mw.debugPreview();
    expect(mw.importedObj).toBeNull();
    expect(mw.previewMode).toBe(mode);
    expect(mw.m_currentPreviewLine).toBe(mode === 'build' ? 6 : 3);
    expect(mw.m_geometryScene.meshes).toHaveLength(mode === 'build' ? 1 : 0);
    expect(log).toContain('setGeometryScene(obj)');
    expect(log).toContain('setRuntimeResult(obj)');
    mw.dispose();
  });

  it('keeps OBJ preview independent from code edits and restores code on request', () => {
    const { mw, editor, log } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    const imported = parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3');
    mw.replacePreviewWithObj(imported, 'triangle.obj');
    expect(editor.text).toBe(kSource);
    expect(mw.canExportObj).toBe(true);
    expect(parseObj(mw.exportObj()).meshes[0].indices).toHaveLength(3);
    log.length = 0;
    editor.type(kSource.replace('double w = 2', 'double w = 4'), 6);
    vi.advanceTimersByTime(220);
    expect(log).not.toContain('setGeometryScene(obj)');
    expect(log).not.toContain('setRuntimeResult(obj)');
    expect(mw.importedObj?.name).toBe('triangle.obj');
    mw.returnToCodePreview();
    expect(mw.importedObj).toBeNull();
    expect(log).toContain('setGeometryScene(obj)');
    expect(parseObj(mw.exportObj()).meshes[0].indices.length).toBeGreaterThan(3);
    mw.dispose();
  });

  it('Esc clears imported OBJ mesh selection and focus without changing the model or camera', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    const engine = createEngine();
    mw.bindViewport(createViewport3DHandle(engine));
    engine.setMeshSelectionCallback(mw.onViewportMeshSelection);
    engine.selectionModeButtonClicked();
    engine.selectionModeButtonClicked();
    const imported = parseObj(writeObj(scene(boxMesh([-1, -1, -1], [1, 1, 1]), boxMesh([4, -1, -1], [6, 1, 1]))));
    mw.replacePreviewWithObj(imported, 'two-meshes.obj');
    const camera = engine.camera();
    const before = { target: camera.target, distance: camera.distance, yaw: camera.yaw, pitch: camera.pitch };
    const first = project(engine, new QVector3D(0, 0, 0));
    click(engine, first.x, first.y);
    expect(engine.selectedMeshIndex()).toBe(0);
    mw.handleKeyDown(keyEvent('Escape'));
    expect(engine.selectedMeshIndex()).toBe(-1);
    expect(engine.isMeshSelected(0)).toBe(false);

    const second = project(engine, new QVector3D(5, 0, 0));
    click(engine, second.x, second.y);
    expect(engine.selectedMeshIndex()).toBe(1);
    engine.setSelectedApiCall(-1, true);
    engine.setApiFocusIndices(new Set());
    mw.handleKeyDown(keyEvent('Escape'));
    expect(engine.selectedMeshIndex()).toBe(-1);
    expect(engine.hasMeshFocus()).toBe(false);
    expect(engine.hasApiFocus()).toBe(false);
    click(engine, first.x, first.y);
    expect(engine.selectedMeshIndex()).toBe(0);
    mw.handleKeyDown(keyEvent('Escape'));
    expect(camera.target).toEqual(before.target);
    expect([camera.distance, camera.yaw, camera.pitch]).toEqual([before.distance, before.yaw, before.pitch]);
    expect(mw.importedObj?.scene).toBe(imported);
    expect(editor.text).toBe('');
    mw.dispose();
  });

  it('starts like the Qt constructor and debounces edits by 220 ms', () => {
    const { mw, log, editor, variables } = createMainWindow();
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
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(variables.summary).toMatch(/^State after line 6 {2}\| {2}\d+ variable\(s\)/);
    expect(mw.statusBar().currentMessage()).toMatch(/^Line 6 \| 1 live mesh\(es\) \| 1 API call\(s\)$/);
    vi.advanceTimersByTime(2600);
    expect(mw.statusBar().currentMessage()).toBe('');
    mw.dispose();
  });

  it('discovers get_val parameters from the whole source, independent of the cursor', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    vi.advanceTimersByTime(220);
    expect(mw.m_currentPreviewLine).toBe(1);
    expect(parameters.rows.map((row) => row.texts[0])).toEqual(['Width']);
    expect(mw.m_lastResult.apiCalls).toHaveLength(0);
    mw.dispose();
  });

  it('keeps the preview line while browsing trace sources and resumes on manual navigation', () => {
    const { mw, editor, apiTrace } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    expect(mw.m_lastResult.apiCalls.map((call) => call.name)).toEqual(['makeDisc']);

    const api = apiTrace.m_tree.topLevelItem(0);
    apiTrace.m_tree.mousePressEvent({
      item: api,
      column: 1,
      modifiers: { shift: false, control: false },
      onDecoration: false,
    });
    expect(mw.statusBar().currentMessage()).toBe('API #1 makeDisc | 2 point/vector input(s), 1 call(s) in focus');
    apiTrace.m_tree.mouseReleaseEvent({
      item: api,
      column: 1,
      modifiers: { shift: false, control: false },
      onDecoration: false,
    });
    expect(editor.currentLine()).toBe(5);
    expect(editor.traceLines).toEqual({ lines: [5], active: 5 });
    expect(mw.m_browsingTrace).toBe(true);
    expect(mw.statusBar().currentMessage()).toBe('Source line 5 - keeping preview at line 6');

    mw.runPreview();
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(apiTrace.selectedApiCall()).toBe(0);

    editor.moveTo(2);
    expect(mw.m_browsingTrace).toBe(false);
    expect(editor.traceLines.lines).toEqual([]);
    vi.advanceTimersByTime(220);
    expect(mw.m_currentPreviewLine).toBe(2);
    mw.dispose();
  });

  it('selects variables from the viewport and navigates to their last assignment', () => {
    const { mw, log, editor, variables } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    log.length = 0;
    mw.onViewportSelectionChanged(new Set(['n']));
    expect(log).toContain('setSelectedVariables({n})');
    expect(variables.selectedVariable()).toBe('n');
    expect(editor.currentLine()).toBe(4);
    expect(editor.traceLines).toEqual({ lines: [4], active: 4 });
    mw.dispose();
  });

  it('inserts a real declaration for a point created in the viewport', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type('FdPoint3d pPreview1(0, 0, 0);\n', 1);
    mw.onViewportPointCreation({ x: 1.25, y: -0.0004, z: 2.0004 });
    expect(editor.text).toBe('FdPoint3d pPreview1(0, 0, 0);\nFdPoint3d pPreview2(1.25, 0, 2);\n\n');
    expect(editor.currentLine()).toBe(3);
    expect(editor.focused).toBe(true);
    expect(mw.statusBar().currentMessage()).toBe('Inserted pPreview2 from viewport: FdPoint3d pPreview2(1.25, 0, 2);');
    mw.dispose();
  });

  it('Esc exits the Link preview and clears the API focus', () => {
    const { mw, log, editor, apiTrace, links } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    links.addConnector();
    links.sizeTextChanged('diameter', 'w');
    links.testSelection();
    expect(log).toContain('setConnectorPreviews([1], 1)');
    expect(log.at(-1)).toBe('fitScene()');

    apiTrace.selectMeshApiCall(0);
    log.length = 0;
    mw.handleKeyDown(keyEvent('Escape'));
    expect(log).toContain('setConnectorPreviews([0], 1)');
    expect(log).toContain('clearApiFocus()');
    expect(apiTrace.selectedApiCall()).toBe(-1);
    expect(apiTrace.meshApiCall()).toBe(-1);
    mw.dispose();
  });

  it('dispatches action shortcuts, letting single-key shortcuts yield to text input', () => {
    const { mw, log } = createMainWindow();
    mw.start();
    vi.advanceTimersByTime(220);
    log.length = 0;
    const inInput = keyEvent('f', {}, 'input');
    mw.handleKeyDown(inInput);
    expect(log).toEqual([]);
    expect(inInput.preventDefault).not.toHaveBeenCalled();

    const inTree = keyEvent('f', {}, 'tree');
    mw.handleKeyDown(inTree);
    expect(log).toEqual(['fitDebugOverlay()']);
    expect(inTree.preventDefault).toHaveBeenCalled();

    log.length = 0;
    const run = keyEvent('r', { control: true }, 'input');
    mw.handleKeyDown(run);
    expect(run.preventDefault).toHaveBeenCalled();
    expect(log).toContain('setRuntimeResult(obj)');

    log.length = 0;
    mw.handleKeyDown(keyEvent('f', {}, 'dialog'));
    expect(log).toEqual([]);
    mw.dispose();
  });
});

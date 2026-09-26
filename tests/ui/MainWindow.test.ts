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
import { declaredFunctionNames, removeFunctionSource, sourceFunctions } from '../../src/helpers/functions';

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

  setSource(source: string) {
    this.type(source, 1);
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
  apiTrace.setFunctionActivatedCallback(mw.onApiTraceFunctionActivated);
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

  it.each(['Separate', 'Unite'] as const)(
    '%s shows only input points for sub-function calls in Main and opens their editor on double-click',
    (presentation) => {
      const { mw, editor, apiTrace } = createMainWindow();
      const engine = createEngine();
      mw.bindViewport(createViewport3DHandle(engine));
      mw.start();
      if (presentation === 'Unite') engine.toggleSelectionPresentation();
      editor.type(
        `void element() {
FdPoint3d cP(1,2,3), points[2] = {cP, FdPoint3d(4,5,6)};
withPoint(cP, vz);
withoutPoint();
withPoints(points);
}
void withPoint(FdPoint3d center, FdVector3d axis=FdVector3d(0,0,1)) {
FdPoint3d internal = center + axis * 10;
leaf(internal);
makeFlatDisc(internal, axis, 4, 8);
}
void leaf(FdPoint3d point) { makeFlatDisc(point, vz, 2, 8); }
void withoutPoint() { withPoint(FdPoint3d(10,20,30), vx); }
void withPoints(FdPoint3d points[2]) { makeFlatDisc(points[0], vz, 3, 8); }`,
        1,
      );
      mw.buildPreview();
      expect(mw.m_lastResult.diagnostics).toEqual([]);
      const geometry = mw.m_geometryScene;
      const focus = vi.spyOn(engine, 'setApiFocusIndices');

      const select = (row: number) => apiTrace.m_tree.setCurrentItem(apiTrace.m_tree.topLevelItem(row));

      select(0);
      expect(engine.pointLabelPanel().entries()).toEqual([
        { id: '@api0:point:center', name: 'cP', value: '(1, 2, 3)' },
      ]);
      expect(engine.vectorLabelPanel().entries()).toEqual([]);
      expect(engine.vectorLabelPanel().isVisible()).toBe(false);
      expect(focus).toHaveBeenLastCalledWith(new Set([0, 1, 2, 3]), new Set([0]));
      expect(mw.m_geometryScene).toBe(geometry);
      select(1);
      expect(engine.pointLabelPanel().entries()).toEqual([]);
      expect(engine.vectorLabelPanel().entries()).toEqual([]);
      expect(engine.pointLabelPanel().isVisible()).toBe(false);
      expect(engine.vectorLabelPanel().isVisible()).toBe(false);
      select(2);
      expect(
        engine
          .pointLabelPanel()
          .entries()
          .map((entry) => [entry.name, entry.value]),
      ).toEqual([
        ['points[0]', '(1, 2, 3)'],
        ['points[1]', '(4, 5, 6)'],
      ]);
      // A native API still exposes its own input points and vectors in Main.
      apiTrace.selectMeshApiCall(2);
      expect(engine.pointLabelPanel().entries()).toHaveLength(1);
      expect(engine.vectorLabelPanel().entries()).toHaveLength(1);
      apiTrace.clearApiFocus();
      const item = apiTrace.m_tree.topLevelItem(0);
      const event = { item, column: 1, modifiers: { shift: false, control: false }, onDecoration: false };
      apiTrace.m_tree.mousePressEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      expect(mw.functions.active).toBe('');
      apiTrace.m_tree.mouseDoubleClickEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      expect(mw.functions.active).toBe('withPoint');
      expect(editor.text).toContain('void withPoint(');
      expect(editor.text).not.toContain('void element(');
      expect(apiTrace.historyDialog()).toBeNull();
      expect(mw.m_lastResult.diagnostics).toEqual([]);
      expect(mw.m_geometryScene.meshes).toHaveLength(2);
      // Inside the function tab, its nested API inputs remain available for debugging.
      apiTrace.m_tree.setCurrentItem(apiTrace.m_tree.topLevelItem(0));
      expect(engine.pointLabelPanel().entries().length).toBeGreaterThan(1);
      expect(engine.vectorLabelPanel().entries().length).toBeGreaterThan(0);
      mw.dispose();
    },
  );

  it('opens the exact overload using its custom tab label from API Trace', () => {
    const { mw, editor, apiTrace } = createMainWindow();
    mw.start();
    editor.type('void element() { part(2); part(FdPoint3d(1,2,3)); }', 1);
    const definitions = [
      ['Numeric part', 'void part(const int count=1) { makeFlatDisc(FdPoint3d(), vz, count, 8); }'],
      ['Point part', 'void part(const FdPoint3d &center) { makeFlatDisc(center, vz, 3, 8); }'],
    ];
    for (const [label, source] of definitions) {
      mw.addFunction(label);
      editor.type(source, 1);
      mw.saveFunction();
    }
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    for (const [index, [label, source]] of definitions.entries()) {
      const item = apiTrace.m_tree.topLevelItem(index);
      const event = { item, column: 1, modifiers: { shift: false, control: false }, onDecoration: false };
      apiTrace.m_tree.mousePressEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      apiTrace.m_tree.mouseDoubleClickEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      expect(mw.functions.active).toBe(label);
      expect(editor.text).toBe(source);
      expect(mw.m_lastResult.diagnostics).toEqual([]);
      expect(mw.m_geometryScene.meshes).toHaveLength(1);
      expect(apiTrace.historyDialog()).toBeNull();
      mw.selectFunction('');
    }
    mw.dispose();
  });

  it('enables Sub-Parameter only in a function editor and blocks its actions from Main', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    const source = 'void element() {}\nvoid helper(double A=1) { double result=A; }';
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.canEditSubParameters).toBe(false);
    mw.raiseDock('SubParametersDock');
    expect(mw.raisedDock()).toBe('ParametersDock');
    mw.setFunctionInput('helper', 'A', ['1'], 0, '99');
    mw.applyFunctionInputs('helper');
    expect(mw.functions.inputs.has('helper')).toBe(false);
    expect(mw.functions.active).toBe('');
    mw.selectFunction('helper');
    expect(mw.canEditSubParameters).toBe(true);
    mw.raiseDock('SubParametersDock');
    expect(mw.raisedDock()).toBe('SubParametersDock');
    mw.setFunctionInput('helper', 'A', ['1'], 0, '12');
    mw.applyFunctionInputs('helper');
    expect(mw.m_runtime.evaluateNumericExpression('result')).toBe(12);
    mw.selectFunction('');
    expect(mw.canEditSubParameters).toBe(false);
    expect(mw.raisedDock()).toBe('ParametersDock');
    mw.applyFunctionInputs('helper');
    expect(editor.text).toBe(source);
    expect(mw.functions.active).toBe('');
    mw.dispose();
  });

  it('deletes an attached function, its draft, arguments, parameter values and tab without restoring them from Build', () => {
    const { mw, editor, parameters } = createMainWindow();
    const main = 'void element() { double D=100; get_val("D", D); }';
    mw.start();
    editor.type(main, 1);
    mw.buildPreview();
    parameters.importTable('D\n100\n130');
    mw.addFunction('helper');
    const sub = 'void helper(double A) { double D=20; get_val("D", D); }';
    editor.type(sub, 1);
    mw.buildPreview();
    mw.setFunctionInput('helper', 'A', ['0'], 0, '12');
    parameters.selectTab('helper');
    parameters.importTable('D\n35\n45');
    mw.applyParameters();
    mw.saveFunction();
    mw.selectFunction('helper');
    mw.attachFunction();
    mw.selectFunction('');
    mw.buildPreview();
    mw.selectFunction('helper');
    editor.type(sub.replace('D=20', 'D=90'), 1);
    mw.raiseDock('SubParametersDock');
    mw.deleteFunction();
    expect(mw.functions.active).toBe('');
    expect(editor.text.trim()).toBe(main);
    expect(mw.functions.names).toEqual([]);
    expect(mw.functions.saved.has('helper')).toBe(false);
    expect(mw.functions.drafts.has('helper')).toBe(false);
    expect(mw.functions.inputs.has('helper')).toBe(false);
    expect(parameters.values().has('helper::D')).toBe(false);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['element']);
    expect(parameters.values().get('element::D')).toBe('100');
    expect(parameters.dataSets.map((row) => row.get('element::D'))).toEqual(['100', '130']);
    expect(mw.raisedDock()).toBe('ParametersDock');
    expect(mw.debugBlocked).toBe(true);
    mw.applyParameters();
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['element']);
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.addFunction('helper')).toBe(true);
    editor.type(sub, 1);
    mw.buildPreview();
    parameters.selectTab('helper');
    expect(parameters.values().get('helper::D')).toBe('20');
    expect(parameters.dataSets).toEqual([]);
    expect(mw.functions.inputs.has('helper')).toBe(false);
    mw.dispose();
  });

  it('deletes inline definitions and forward declarations while preserving other code and Main', () => {
    const { mw, editor } = createMainWindow();
    const source =
      'void helper();\nvoid element() { helper(); }\nvoid helper() {}\nvoid helper2() { const char* name="helper"; }';
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    mw.deleteFunction();
    expect(editor.text).toBe(source);
    mw.selectFunction('helper');
    mw.deleteFunction();
    expect(declaredFunctionNames(editor.text).has('helper')).toBe(false);
    expect(editor.text).toContain('void element() { helper(); }');
    expect(editor.text).toContain('void helper2() { const char* name="helper"; }');
    expect(mw.functions.names).toEqual(['helper2']);
    expect(mw.addFunction('helper')).toBe(true);
    mw.deleteFunction();
    expect(mw.functions.names).toEqual(['helper2']);
    mw.dispose();
  });

  it('keeps a function tab and its latest code when the definition is removed manually from Main', () => {
    const { mw, editor, parameters } = createMainWindow();
    const main = 'void element() { helper(); }';
    const helper = 'void helper(double A=1) { double D=20; get_val("D", D); double value=A+D; }';
    mw.start();
    editor.type(main + '\n' + helper, 1);
    mw.buildPreview();
    parameters.selectTab('helper');
    parameters.importTable('D\n30\n40');
    mw.applyParameters();
    const latest = helper.replace('value=A+D', 'value=A+D+5');
    editor.type(main + '\n' + latest, 1);
    editor.type(main, 1);
    expect(mw.functions.names).toEqual(['helper']);
    expect(mw.functions.source('helper')).toBe(latest);
    mw.applyParameters();
    expect(editor.text).toBe(main);
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    mw.selectFunction('helper');
    expect(editor.text).toBe(latest);
    expect(parameters.values().get('helper::D')).toBe('30');
    expect(parameters.dataSets).toHaveLength(2);
    expect(mw.m_runtime.evaluateNumericExpression('value')).toBe(36);
    mw.deleteFunction();
    expect(mw.functions.names).toEqual([]);
    expect(mw.functions.saved.has('helper')).toBe(false);
    expect(editor.text).toBe(main);
    mw.dispose();
  });

  it('Sub-Parameter OK rebuilds the current function code and applies its arguments and get_val values together', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(
      `void element() {}
void helper(FdPoint3d cP, double L=50) {
double D=20; get_val("D", D);
makeVerySimpleTube(cP, cP + vz * L, D, 8);
}`,
      1,
    );
    mw.buildPreview();
    mw.selectFunction('helper');
    const built = mw.buildNumber;
    editor.type(editor.text.replace('D, 8', 'D*2, 8'), 1);
    mw.setFunctionInput('helper', 'cP', ['0', '0', '0'], 2, '10');
    mw.setFunctionInput('helper', 'L', ['50'], 0, '80');
    parameters.edit(
      parameters.rows.findIndex((row) => row.key === 'helper::D'),
      3,
    );
    parameters.editorTextEdited('30');
    expect(mw.debugBlocked).toBe(true);
    mw.applyFunctionInputs('helper');
    expect(mw.functions.active).toBe('helper');
    expect(mw.buildNumber).toBe(built + 1);
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls[0].arguments.slice(0, 3)).toMatchObject([
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 90 },
      60,
    ]);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.executionFeedback.source).toBe(editor.text);
    expect(mw.debugBlocked).toBe(false);
    expect(mw.previewDirty).toBe(false);
    expect(parameters.editor).toBeNull();
    mw.dispose();
  });

  it.each(['double gone(double), keep(double);', 'double keep(double), gone(double);'])(
    'keeps the other prototype when deleting from %s',
    (source) => {
      const next = removeFunctionSource(source + '\ndouble gone(double A) { return A; }', 'gone');
      expect(declaredFunctionNames(next)).toEqual(new Set(['keep']));
      expect(next).toContain('double');
      expect(next).not.toContain('gone');
    },
  );

  it('creates, previews, saves, reopens and attaches a function without duplicating its definition', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    const main = 'void element() { makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), 100, 8); }';
    editor.type(main, 1);
    mw.buildPreview();
    expect(mw.addFunction('Main')).toBe(false);
    expect(mw.functions.error).toContain('already exists');
    expect(mw.addFunction('   ')).toBe(false);
    expect(mw.addFunction('piece')).toBe(true);
    expect(editor.text).toContain('void piece()');
    const sub = 'void piece(FdPoint3d cP, FdVector3d vP, double A) { makeVerySimpleTube(cP, cP + vP * A, 20, 8); }';
    editor.type(sub, 1);
    mw.setFunctionInput('piece', 'cP', ['0', '0', '0'], 0, '12');
    mw.setFunctionInput('piece', 'vP', ['0', '0', '0'], 2, '1');
    mw.setFunctionInput('piece', 'A', ['0'], 0, '40');
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls[0].arguments[0]).toMatchObject({ x: 12, y: 0, z: 0 });
    expect(mw.m_lastResult.apiCalls[0].arguments[1]).toMatchObject({ x: 12, y: 0, z: 40 });
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.functions.parameterFunctions.map((fn) => fn.name)).toEqual(['piece']);
    mw.saveFunction();
    expect(mw.functions.active).toBe('');
    expect(editor.text).toBe(main);
    expect(mw.functions.names).toEqual(['piece']);
    mw.selectFunction('piece');
    expect(editor.text).toBe(sub);
    mw.attachFunction();
    expect(mw.functions.mainSource).toContain(sub);
    expect(mw.functions.names).toEqual(['piece']);
    const attached = mw.functions.mainSource;
    mw.attachFunction();
    expect(mw.functions.error).toBe('Function already exists.');
    expect(mw.functions.mainSource).toBe(attached);
    editor.type(sub.replace('20, 8', '30, 8'), 1);
    mw.cancelFunction();
    expect(editor.text).toBe(attached);
    mw.selectFunction('piece');
    expect(editor.text).toBe(sub);
    mw.dispose();
  });

  it('Cancel discards a new function, and Save rejects malformed definitions', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    mw.buildPreview();
    mw.addFunction('draft');
    editor.type('void draft() {', 1);
    mw.saveFunction();
    expect(mw.functions.error).toContain('complete C++ function');
    expect(mw.functions.active).toBe('draft');
    mw.cancelFunction();
    expect(mw.functions.names).toEqual([]);
    expect(editor.text).toBe(kSource);
    expect(mw.functions.parameterFunctions).toEqual([]);
    mw.dispose();
  });

  it('uses independent tab labels for overloads through preview, parameters, Save, Attach and Delete', () => {
    const { mw, editor, parameters } = createMainWindow();
    const main = `double makePart(double);
double makePart(FdPoint3d);
void element() {
double first=makePart(2.0);
double second=makePart(FdPoint3d(0,0,3));
}`;
    const numeric =
      'double makePart(double A) { double D=20; get_val("D", D); makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,A), D, 8); return A+D; }';
    const point =
      'double makePart(FdPoint3d cP) { double D=40; get_val("D", D); makeVerySimpleTube(cP, cP+vz*10, D, 8); return cP.z+D; }';
    const first = 'Đế quạt / 1',
      second = 'Part (point)';
    mw.start();
    editor.type(main, 1);
    expect(mw.addFunction(first)).toBe(true);
    expect(editor.text).toContain('void subFunction()');
    editor.type(numeric, 1);
    mw.saveFunction();
    expect(mw.functions.error).toBe('');
    expect(mw.functions.names).toEqual([first]);
    expect(mw.addFunction(` ${first} `)).toBe(false);
    expect(mw.functions.error).toContain('unique tab name');
    expect(mw.addFunction(second)).toBe(true);
    editor.type(point, 1);
    mw.saveFunction();
    expect(mw.functions.error).toBe('');
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_runtime.evaluateNumericExpression('first')).toBe(22);
    expect(mw.m_runtime.evaluateNumericExpression('second')).toBe(43);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual([first, second]);
    parameters.selectTab(first);
    parameters.importTable('D\n30');
    mw.applyParameters();
    expect(mw.m_runtime.evaluateNumericExpression('first')).toBe(32);
    expect(mw.m_runtime.evaluateNumericExpression('second')).toBe(43);

    mw.selectFunction(second);
    mw.setFunctionInput(second, 'cP', ['0', '0', '0'], 2, '100');
    parameters.importTable('D\n50');
    mw.applyFunctionInputs(second);
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls[0].arguments.slice(0, 3)).toMatchObject([
      { x: 0, y: 0, z: 100 },
      { x: 0, y: 0, z: 110 },
      50,
    ]);
    expect(mw.functions.parameterFunctions.map((fn) => fn.name)).toEqual([first, second]);
    mw.attachFunction();
    expect(mw.functions.error).toBe('');
    mw.attachFunction();
    expect(mw.functions.error).toBe('Function already exists.');
    mw.selectFunction(first);
    mw.setFunctionInput(first, 'A', ['0'], 0, '70');
    mw.applyFunctionInputs(first);
    expect(mw.m_lastResult.apiCalls[0].arguments.slice(1, 3)).toMatchObject([{ x: 0, y: 0, z: 70 }, 30]);
    mw.attachFunction();
    expect(mw.functions.error).toBe('');

    // A return type or parameter-name change alone is not a new overload.
    mw.selectFunction('');
    expect(mw.addFunction('Duplicate')).toBe(true);
    editor.type('int makePart(const double another=1) { return 0; }', 1);
    mw.saveFunction();
    expect(mw.functions.error).toContain('Function already exists: makePart(double)');
    mw.cancelFunction();
    mw.selectFunction(second);
    mw.deleteFunction();
    expect(mw.functions.names).toEqual([first]);
    expect(editor.text).not.toContain(point);
    expect(editor.text).not.toContain('double makePart(FdPoint3d);');
    expect(editor.text).toContain(numeric);
    expect(editor.text).toContain('double makePart(double);');
    expect(parameters.values().get(`${first}::D`)).toBe('30');
    expect(parameters.values().has(`${second}::D`)).toBe(false);
    mw.dispose();
  });

  it('separates inline overload tabs and preserves saved scopes when another tab has an unsaved signature', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(
      `void element() { double a=part(2); double b=part(2.0); }
double part(int n) { double D=10; get_val("D", D); return D+n; }
double part(double n) { double D=20; get_val("D", D); return D+n; }`,
      1,
    );
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.functions.names).toEqual(['part(int)', 'part(double)']);
    expect(mw.m_runtime.evaluateNumericExpression('a')).toBe(12);
    expect(mw.m_runtime.evaluateNumericExpression('b')).toBe(22);
    mw.selectFunction('part(int)');
    parameters.importTable('D\n35');
    mw.applyParameters();
    editor.type(editor.text.replace('part(int n)', 'renamed(int n)'), 1);
    mw.selectFunction('');
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_runtime.evaluateNumericExpression('a')).toBe(37);
    expect(mw.m_runtime.evaluateNumericExpression('b')).toBe(22);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['part(int)', 'part(double)']);
    mw.selectFunction('part(int)');
    mw.deleteFunction();
    expect(mw.functions.names).toEqual(['part(double)']);
    expect(editor.text).not.toContain('double part(int n)');
    expect(editor.text).toContain('double part(double n)');
    mw.dispose();
  });

  it('allows a tab label to match the Main C++ name without merging their parameters', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type('void element() { double D=10; get_val("D", D); helper(); }', 1);
    expect(mw.addFunction('element')).toBe(true);
    editor.type('void helper() { double D=20; get_val("D", D); }', 1);
    mw.saveFunction();
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['Main', 'element']);
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(10);
    mw.selectFunction('element');
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(20);
    mw.selectFunction('');
    expect(parameters.activeTab).toBe('Main');
    mw.dispose();
  });

  it.each([
    ['const FdPoint3d &p', 'FdPoint3d const &q', 'makePart(const FdPoint3d&)'],
    ['double values[3]', 'double* other', 'makePart(double*)'],
    ['const double value=1', 'ads_real other', 'makePart(double)'],
    ['char* const text', 'char* other', 'makePart(char*)'],
  ])('recognizes equivalent overload signatures %s and %s', (first, second, signature) => {
    expect(sourceFunctions(`void makePart(${first}) {}`)[0].signature).toBe(signature);
    expect(sourceFunctions(`void makePart(${second}) {}`)[0].signature).toBe(signature);
    const code = `void makePart(${second});\nvoid makePart(${first}) {}\nvoid makePart(int n) {}`;
    expect(removeFunctionSource(code, 'makePart', signature).trim()).toBe('void makePart(int n) {}');
  });

  it('previews inline helpers independently and isolates their same-name get_val values', () => {
    const { mw, editor, parameters } = createMainWindow();
    const source = [
      'void element() { double D=100; get_val("D", D); makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), D, 8); }',
      'void helper(double A) { double D=20; get_val("D", D); makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,A), D, 8); }',
      'void empty() {}',
    ].join('\n');
    mw.start();
    editor.type(source, 3);
    mw.buildPreview();
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(100);
    expect(mw.functions.names).toEqual(['helper', 'empty']);
    expect(mw.functions.parameterFunctions.map((fn) => fn.name)).toEqual(['helper']);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['element', 'helper']);
    mw.selectFunction('helper');
    mw.setFunctionInput('helper', 'A', ['0'], 0, '50');
    parameters.edit(
      parameters.rows.findIndex((row) => row.key === 'helper::D'),
      3,
    );
    parameters.editorTextEdited('25');
    mw.applyParameters();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_runtime.evaluateNumericExpression('A')).toBe(50);
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(25);
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    mw.selectFunction('');
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(100);
    expect(parameters.values().get('helper::D')).toBe('25');
    expect(parameters.values().get('element::D')).toBe('100');
    mw.dispose();
  });

  it('edits attached function source on Save and keeps main Build frozen until explicitly rebuilt', () => {
    const { mw, editor } = createMainWindow();
    const source =
      'void element() { helper(); }\nvoid helper() { makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), 20, 8); }';
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    const before = mw.exportObj();
    mw.selectFunction('helper');
    editor.type(editor.text.replace('20, 8', '40, 8'), 1);
    mw.saveFunction();
    expect(editor.text).toContain('40, 8');
    expect(mw.debugBlocked).toBe(true);
    expect(mw.exportObj()).toBe(before);
    mw.buildPreview();
    expect(mw.exportObj()).not.toBe(before);
    expect(mw.debugBlocked).toBe(false);
    mw.dispose();
  });

  it('keeps Debug in the selected function and does not leak main-script geometry into a helper preview', () => {
    const { mw, editor } = createMainWindow();
    const source = [
      'void element() { makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), 100, 8); }',
      'void helper(double A=40) {',
      ' makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,A), 20, 8);',
      ' double later=3;',
      '}',
    ].join('\n');
    mw.start();
    editor.type(source, 5);
    mw.buildPreview();
    mw.debugPreview();
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls[0].arguments[2]).toBe(100n);
    mw.selectFunction('helper');
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls[0].arguments[2]).toBe(20n);
    editor.moveTo(1);
    vi.advanceTimersByTime(220);
    expect(mw.m_lastResult.apiCalls).toEqual([]);
    editor.moveTo(3);
    vi.advanceTimersByTime(220);
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_runtime.evaluateNumericExpression('later')).toBe(3);
    mw.dispose();
  });

  it('handles invalid input, signature removal and main-code edits without retaining stale function drafts', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    const source = 'void element() {}\nvoid helper(double A) { double value=A; }';
    editor.type(source, 1);
    mw.buildPreview();
    mw.selectFunction('helper');
    mw.setFunctionInput('helper', 'A', ['0'], 0, '');
    mw.applyParameters();
    expect(mw.functions.error).toBe('Enter a number for A.');
    expect(() => mw.selectFunction('')).not.toThrow();
    editor.type(source.replace('double A', '').replace('double value=A', 'double value=7'), 1);
    mw.buildPreview();
    expect(mw.functions.parameterFunctions).toEqual([]);
    mw.selectFunction('helper');
    mw.buildPreview();
    expect(editor.text).toBe('void helper() { double value=7; }');
    expect(mw.m_runtime.evaluateNumericExpression('value')).toBe(7);
    mw.dispose();
  });

  it('runs a main script once and excludes its geometry when previewing a helper', () => {
    const { mw, editor } = createMainWindow();
    const source = [
      'double D=100; get_val("D", D);',
      'makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), D, 8);',
      'helper();',
      'void helper() { makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,50), D/2, 8); }',
    ].join('\n');
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.functions.names).toEqual(['helper']);
    expect(mw.m_geometryScene.meshes).toHaveLength(2);
    mw.selectFunction('helper');
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls).toHaveLength(1);
    expect(mw.m_lastResult.apiCalls[0].arguments[2]).toBe(50);
    mw.dispose();
  });

  it('uses the first definition with forward declarations and rejects duplicate prototype names', () => {
    const { mw, editor } = createMainWindow();
    const source =
      'double helper(double A);\nvoid element() { double result=helper(12); }\ndouble helper(double A) { return A*2; }';
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.m_lastResult.diagnostics).toEqual([]);
    expect(mw.m_runtime.evaluateNumericExpression('result')).toBe(24);
    expect(mw.functions.names).toEqual(['helper']);
    expect(mw.addFunction('helper')).toBe(false);
    expect(mw.addFunction('switch')).toBe(true);
    expect(editor.text).toContain('void subFunction()');
    mw.cancelFunction();
    mw.dispose();
  });

  it.each(['inline', 'saved', 'attached'])('receives makeFS return values in Main (%s function)', (mode) => {
    const { mw, editor, parameters } = createMainWindow();
    const main = `void element() {
FdPoint3d cP(1,2,7);
double H=5;
double height=makeFS(cP);
double assigned=0;
assigned=makeFS(cP);
cP.z += makeFS(cP);
double mainH=H;
makeVerySimpleTube(cP, cP + vz * height, 10, 8);
}`;
    const helper = `double makeFS(FdPoint3d cP) {
double A, B, C, H, t1;
get_val("RB_A", A);
get_val("RB_B", B);
get_val("RB_C", C);
get_val("RB_H", H);
get_val("RB_t1", t1);
FdPoint3d fullPoints[2] = { cP, cP };
fullPoints[1].z += H;
FdVector3d normalVectors[2] = { vz, vz };
FdVector3d upVectors[2] = { vx, vx };
double tabHeight[2] = { B, B }, tabWidth[2] = { B, B };
bool sides[4] = { true, true, true, true };
makeBox(1, fullPoints, normalVectors, upVectors, tabHeight, tabWidth, sides, false, false, 0, 0, 0);
tabHeight[0] = tabHeight[1] = C;
tabWidth[0] = tabWidth[1] = C;
makeBox(1, fullPoints, normalVectors, upVectors, tabWidth, tabHeight, sides, false, false, 0, 0, (B-C)*0.5);
fullPoints[1].z = fullPoints[0].z + 2;
makeBox(1, fullPoints, normalVectors, upVectors, tabWidth, tabHeight, sides, false, false, 0, 0, (A-C)*0.5);
tabHeight[0] = tabHeight[1] = A;
tabWidth[0] = tabWidth[1] = A;
makeBox(1, fullPoints, normalVectors, upVectors, tabWidth, tabHeight, sides, false, false, 0, 0, 0);
return H;
}`;
    mw.start();
    editor.type(mode === 'inline' ? main + '\n' + helper : main, 1);
    if (mode !== 'inline') {
      expect(mw.addFunction('makeFS')).toBe(true);
      editor.type(helper, 1);
      mw.saveFunction();
      if (mode === 'attached') {
        mw.selectFunction('makeFS');
        mw.attachFunction();
        mw.selectFunction('');
      }
    }
    mw.buildPreview();
    parameters.selectTab('makeFS');
    parameters.importTable('RB_A\tRB_B\tRB_C\tRB_H\tRB_t1\n300\t200\t160\t80\t1');
    mw.applyParameters();

    const checkMain = (height: number) => {
      expect(mw.m_lastResult.diagnostics).toEqual([]);
      expect(mw.m_geometryScene.warnings).toEqual([]);
      expect(mw.m_runtime.evaluateNumericExpression('height')).toBe(height);
      expect(mw.m_runtime.evaluateNumericExpression('assigned')).toBe(height);
      expect(mw.m_runtime.evaluateNumericExpression('cP.z')).toBe(7 + height);
      expect(mw.m_runtime.evaluateNumericExpression('mainH')).toBe(5);
      const tube = mw.m_lastResult.apiCalls.find((call) => call.name === 'makeVerySimpleTube');
      expect(tube?.arguments.slice(0, 2)).toMatchObject([
        { x: 1, y: 2, z: 7 + height },
        { x: 1, y: 2, z: 7 + 2 * height },
      ]);
    };

    checkMain(80);
    // Changing get_val and pressing OK must also update the returned height.
    parameters.edit(
      parameters.rows.findIndex((row) => row.key === 'makeFS::RB_H'),
      3,
    );
    parameters.editorTextEdited('120');
    parameters.commitEditor();
    mw.applyParameters();
    checkMain(120);
    // Standalone preview arguments must not override the actual call from Main.
    mw.selectFunction('makeFS');
    mw.setFunctionInput('makeFS', 'cP', ['0', '0', '0'], 2, '500');
    mw.applyFunctionInputs('makeFS');
    expect(mw.m_runtime.evaluateNumericExpression('cP.z')).toBe(500);
    mw.selectFunction('');
    mw.buildPreview();
    checkMain(120);
    mw.dispose();
  });

  it('routes errors in a saved dependency to its own editor and source line', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type('void element() {}', 1);
    mw.buildPreview();
    mw.addFunction('leaf');
    editor.type('void leaf() {\n double value=missing;\n}', 1);
    mw.saveFunction();
    mw.addFunction('branch');
    editor.type('void branch() { leaf(); }', 1);
    mw.buildPreview();
    const error = mw.executionFeedback.externalDiagnostics?.[0];
    expect(error).toMatchObject({ name: 'leaf', line: 2, message: 'unknown variable: missing' });
    expect(mw.executionFeedback.diagnostics).toEqual([]);
    mw.onApiTraceSourceActivated(error!.sourceLine);
    expect(mw.functions.active).toBe('leaf');
    expect(editor.currentLine()).toBe(2);
    expect(editor.text).toContain('double value=missing');
    mw.dispose();
  });

  it('keeps unconfirmed parameters out of the built preview when returning from another function tab', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type('void element() { double D=100; get_val("D", D); }\nvoid helper() {}', 1);
    mw.buildPreview();
    parameters.edit(0, 3);
    parameters.editorTextEdited('150');
    parameters.commitEditor();
    mw.selectFunction('helper');
    mw.selectFunction('');
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(100);
    expect(parameters.values().get('element::D')).toBe('150');
    expect(mw.previewDirty).toBe(true);
    expect(mw.buildNumber).toBe(1);
    mw.applyParameters();
    expect(mw.m_runtime.evaluateNumericExpression('D')).toBe(150);
    expect(mw.previewDirty).toBe(false);
    mw.dispose();
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
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(parameters.values().get('makeDV::BG')).toBe('0');
    expect(parameters.rows.find((row) => row.key === 'makeBG::D')?.disabled).toBe(true);
    expect(mw.m_lastResult.parameterRequests.map((p) => p.functionName)).toEqual(['makeDV', 'makeDV']);
    parameters.setCheckbox('makeDV::BG', true);
    mw.applyParameters();
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

  it('OK applies a pending string get_val and clears character arithmetic errors without another Build', () => {
    const { mw, editor, parameters } = createMainWindow();
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
    expect(mw.executionFeedback.diagnostics.length).toBeGreaterThan(0);
    const row = parameters.rows.findIndex((item) => item.key === 'zxd_ASS');
    parameters.edit(row, 3);
    parameters.editorTextEdited('6x8');
    mw.applyParameters();
    expect(parameters.editor).toBeNull();
    expect(mw.executionFeedback.diagnostics).toEqual([]);
    expect(mw.m_runtime.evaluateNumericExpression('n')).toBe(6);
    expect(mw.m_runtime.evaluateNumericExpression('d')).toBe(8);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
    expect(mw.buildNumber).toBe(2);
    expect(mw.previewMode).toBe('build');
    expect(mw.previewDirty).toBe(false);
    mw.dispose();
  });

  it('OK builds the current code with the selected parameter row and unlocks Debug', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    const previousObj = mw.exportObj();
    parameters.importTable('Width\n8\n12');
    parameters.selectDataSet(1);
    expect(mw.previewStatus).toContain('press OK in Parameters');
    expect(mw.exportObj()).toBe(previousObj);
    editor.type(kSource.replace('double after = 1', 'double after = 9'), 2);
    mw.applyParameters();
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(12);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(9);
    expect(mw.exportObj()).not.toBe(previousObj);
    expect(mw.executionFeedback.source).toBe(editor.text);
    expect(mw.buildNumber).toBe(2);
    expect(mw.debugBlocked).toBe(false);
    expect(mw.previewDirty).toBe(false);
    expect(mw.previewMode).toBe('build');
    mw.debugPreview();
    expect(mw.previewMode).toBe('debug');
    mw.dispose();
  });

  it('OK builds the full code from Debug and commits a pending parameter edit', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 5);
    vi.advanceTimersByTime(220);
    parameters.edit(0, 3);
    parameters.editorTextEdited('10');
    mw.applyParameters();
    expect(parameters.editor).toBeNull();
    expect(mw.m_runtime.evaluateNumericExpression('w')).toBe(10);
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(mw.m_runtime.evaluateNumericExpression('after')).toBe(1);
    expect(mw.previewMode).toBe('build');
    expect(mw.buildNumber).toBe(1);
    expect(mw.m_geometryScene.meshes).toHaveLength(1);
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

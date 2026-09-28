import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { declaredFunctionNames, removeFunctionSource, sourceFunctions } from '@/entities/source-function';
import { createWorkspace, kSource } from '@tests/pages/workspace/harness';

describe('Workspace: function tabs, Sub-Parameter inputs and saved functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the exact overload using its custom tab label from API Trace', () => {
    const { mw, editor, apiTrace } = createWorkspace();
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
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    for (const [index, [label, source]] of definitions.entries()) {
      const item = apiTrace.m_tree.topLevelItem(index);
      const event = { item, column: 1, modifiers: { shift: false, control: false }, onDecoration: false };
      apiTrace.m_tree.mousePressEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      apiTrace.m_tree.mouseDoubleClickEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      expect(mw.functions.active).toBe(label);
      expect(editor.text).toBe(source);
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.meshes).toHaveLength(1);
      expect(apiTrace.historyDialog()).toBeNull();
      mw.selectFunction('');
    }
    mw.dispose();
  });

  it('enables Sub-Parameter only in a function editor and blocks its actions from Main', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    const source = 'void element() {}\nvoid helper(double A=1) { double result=A; }';
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.canEditSubParameters).toBe(false);
    mw.raiseDock('SubParametersDock');
    expect(mw.raisedDock()).toBe('ParametersDock');
    mw.setFunctionInput('helper', 'A', ['1'], 0, '99');
    mw.applyFunctionInputs('helper');
    expect(mw.functions.hasInputs('helper')).toBe(false);
    expect(mw.functions.active).toBe('');
    mw.selectFunction('helper');
    expect(mw.canEditSubParameters).toBe(true);
    mw.raiseDock('SubParametersDock');
    expect(mw.raisedDock()).toBe('SubParametersDock');
    mw.setFunctionInput('helper', 'A', ['1'], 0, '12');
    mw.applyFunctionInputs('helper');
    expect(mw.session.runtime.evaluateNumericExpression('result')).toBe(12);
    editor.type('void helper() { double result=1; }', 1);
    expect(mw.canEditSubParameters).toBe(false);
    expect(mw.raisedDock()).toBe('ParametersDock');
    editor.type('void helper(double A=1) { double result=A; }', 1);
    expect(mw.raisedDock()).toBe('SubParametersDock');
    mw.selectFunction('');
    expect(mw.canEditSubParameters).toBe(false);
    expect(mw.raisedDock()).toBe('ParametersDock');
    mw.applyFunctionInputs('helper');
    expect(editor.text).toBe(source);
    expect(mw.functions.active).toBe('');
    mw.dispose();
  });

  it('deletes an attached function, its draft, arguments, parameter values and tab without restoring them from Build', () => {
    const { mw, editor, parameters } = createWorkspace();
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
    expect(mw.functions.hasSaved('helper')).toBe(false);
    expect(mw.functions.hasDraft('helper')).toBe(false);
    expect(mw.functions.hasInputs('helper')).toBe(false);
    expect(parameters.values().has('helper::D')).toBe(false);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['element']);
    expect(parameters.values().get('element::D')).toBe('100');
    expect(parameters.dataSets.map((row) => row.get('element::D'))).toEqual(['100', '130']);
    expect(mw.raisedDock()).toBe('ParametersDock');
    expect(mw.session.debugBlocked).toBe(true);
    mw.applyParameters();
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['element']);
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.addFunction('helper')).toBe(true);
    editor.type(sub, 1);
    mw.buildPreview();
    parameters.selectTab('helper');
    expect(parameters.values().get('helper::D')).toBe('20');
    expect(parameters.dataSets).toEqual([]);
    expect(mw.functions.hasInputs('helper')).toBe(false);
    mw.dispose();
  });

  it('deletes inline definitions and forward declarations while preserving other code and Main', () => {
    const { mw, editor } = createWorkspace();
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
    const { mw, editor, parameters } = createWorkspace();
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
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    mw.selectFunction('helper');
    expect(editor.text).toBe(latest);
    expect(parameters.values().get('helper::D')).toBe('30');
    expect(parameters.dataSets).toHaveLength(2);
    expect(mw.session.runtime.evaluateNumericExpression('value')).toBe(36);
    mw.deleteFunction();
    expect(mw.functions.names).toEqual([]);
    expect(mw.functions.hasSaved('helper')).toBe(false);
    expect(editor.text).toBe(main);
    mw.dispose();
  });

  it('Sub-Parameter OK rebuilds the current function code and applies its arguments and get_val values together', () => {
    const { mw, editor, parameters } = createWorkspace();
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
    const built = mw.session.buildNumber;
    editor.type(editor.text.replace('D, 8', 'D*2, 8'), 1);
    mw.setFunctionInput('helper', 'cP', ['0', '0', '0'], 2, '10');
    mw.setFunctionInput('helper', 'L', ['50'], 0, '80');
    parameters.edit(
      parameters.rows.findIndex((row) => row.key === 'helper::D'),
      3,
    );
    parameters.editorTextEdited('30');
    expect(mw.session.debugBlocked).toBe(true);
    mw.applyFunctionInputs('helper');
    expect(mw.functions.active).toBe('helper');
    expect(mw.session.buildNumber).toBe(built + 1);
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls[0].arguments.slice(0, 3)).toMatchObject([
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 90 },
      60,
    ]);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.feedback.source).toBe(editor.text);
    expect(mw.session.debugBlocked).toBe(false);
    expect(mw.session.previewDirty).toBe(false);
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
    const { mw, editor } = createWorkspace();
    mw.start();
    const main = 'void element() { makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), 100, 8); }';
    editor.type(main, 1);
    mw.buildPreview();
    expect(mw.addFunction('Main')).toBe(false);
    expect(mw.functions.error).toContain('already exists');
    // Closing the Add Function dialog must not leave its error in the tab strip.
    mw.clearFunctionError();
    expect(mw.functions.error).toBe('');
    expect(mw.addFunction('   ')).toBe(false);
    expect(mw.addFunction('piece')).toBe(true);
    expect(editor.text).toContain('void piece()');
    const sub = 'void piece(FdPoint3d cP, FdVector3d vP, double A) { makeVerySimpleTube(cP, cP + vP * A, 20, 8); }';
    editor.type(sub, 1);
    mw.setFunctionInput('piece', 'cP', ['0', '0', '0'], 0, '12');
    mw.setFunctionInput('piece', 'vP', ['0', '0', '0'], 2, '1');
    mw.setFunctionInput('piece', 'A', ['0'], 0, '40');
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls[0].arguments[0]).toMatchObject({ x: 12, y: 0, z: 0 });
    expect(mw.session.lastResult.apiCalls[0].arguments[1]).toMatchObject({ x: 12, y: 0, z: 40 });
    expect(mw.session.scene.meshes).toHaveLength(1);
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
    const { mw, editor } = createWorkspace();
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
    const { mw, editor, parameters } = createWorkspace();
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
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('first')).toBe(22);
    expect(mw.session.runtime.evaluateNumericExpression('second')).toBe(43);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual([first, second]);
    parameters.selectTab(first);
    parameters.importTable('D\n30');
    mw.applyParameters();
    expect(mw.session.runtime.evaluateNumericExpression('first')).toBe(32);
    expect(mw.session.runtime.evaluateNumericExpression('second')).toBe(43);

    mw.selectFunction(second);
    mw.setFunctionInput(second, 'cP', ['0', '0', '0'], 2, '100');
    parameters.importTable('D\n50');
    mw.applyFunctionInputs(second);
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls[0].arguments.slice(0, 3)).toMatchObject([
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
    expect(mw.session.lastResult.apiCalls[0].arguments.slice(1, 3)).toMatchObject([{ x: 0, y: 0, z: 70 }, 30]);
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
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type(
      `void element() { double a=part(2); double b=part(2.0); }
double part(int n) { double D=10; get_val("D", D); return D+n; }
double part(double n) { double D=20; get_val("D", D); return D+n; }`,
      1,
    );
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.functions.names).toEqual(['part(int)', 'part(double)']);
    expect(mw.session.runtime.evaluateNumericExpression('a')).toBe(12);
    expect(mw.session.runtime.evaluateNumericExpression('b')).toBe(22);
    mw.selectFunction('part(int)');
    parameters.importTable('D\n35');
    mw.applyParameters();
    editor.type(editor.text.replace('part(int n)', 'renamed(int n)'), 1);
    mw.selectFunction('');
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('a')).toBe(37);
    expect(mw.session.runtime.evaluateNumericExpression('b')).toBe(22);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['part(int)', 'part(double)']);
    mw.selectFunction('part(int)');
    mw.deleteFunction();
    expect(mw.functions.names).toEqual(['part(double)']);
    expect(editor.text).not.toContain('double part(int n)');
    expect(editor.text).toContain('double part(double n)');
    mw.dispose();
  });

  it('allows a tab label to match the Main C++ name without merging their parameters', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type('void element() { double D=10; get_val("D", D); helper(); }', 1);
    expect(mw.addFunction('element')).toBe(true);
    editor.type('void helper() { double D=20; get_val("D", D); }', 1);
    mw.saveFunction();
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['Main', 'element']);
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(10);
    mw.selectFunction('element');
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(20);
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
    const { mw, editor, parameters } = createWorkspace();
    const source = [
      'void element() { double D=100; get_val("D", D); makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), D, 8); }',
      'void helper(double A) { double D=20; get_val("D", D); makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,A), D, 8); }',
      'void empty() {}',
    ].join('\n');
    mw.start();
    editor.type(source, 3);
    mw.buildPreview();
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(100);
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
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('A')).toBe(50);
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(25);
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.scene.meshes).toHaveLength(1);
    mw.selectFunction('');
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(100);
    expect(parameters.values().get('helper::D')).toBe('25');
    expect(parameters.values().get('element::D')).toBe('100');
    mw.dispose();
  });

  it('edits attached function source on Save and keeps main Build frozen until explicitly rebuilt', () => {
    const { mw, editor } = createWorkspace();
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
    expect(mw.session.debugBlocked).toBe(true);
    expect(mw.exportObj()).toBe(before);
    mw.buildPreview();
    expect(mw.exportObj()).not.toBe(before);
    expect(mw.session.debugBlocked).toBe(false);
    mw.dispose();
  });

  it('keeps Debug in the selected function and does not leak main-script geometry into a helper preview', () => {
    const { mw, editor } = createWorkspace();
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
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls[0].arguments[2]).toBe(100n);
    mw.selectFunction('helper');
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls[0].arguments[2]).toBe(20n);
    editor.moveTo(1);
    vi.advanceTimersByTime(220);
    expect(mw.session.lastResult.apiCalls).toEqual([]);
    editor.moveTo(3);
    vi.advanceTimersByTime(220);
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.runtime.evaluateNumericExpression('later')).toBe(3);
    mw.dispose();
  });

  it('handles invalid input, signature removal and main-code edits without retaining stale function drafts', () => {
    const { mw, editor } = createWorkspace();
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
    expect(mw.session.runtime.evaluateNumericExpression('value')).toBe(7);
    mw.dispose();
  });

  it('runs a main script once and excludes its geometry when previewing a helper', () => {
    const { mw, editor } = createWorkspace();
    const source = [
      'double D=100; get_val("D", D);',
      'makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,100), D, 8);',
      'helper();',
      'void helper() { makeVerySimpleTube(FdPoint3d(), FdPoint3d(0,0,50), D/2, 8); }',
    ].join('\n');
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.functions.names).toEqual(['helper']);
    expect(mw.session.scene.meshes).toHaveLength(2);
    mw.selectFunction('helper');
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls).toHaveLength(1);
    expect(mw.session.lastResult.apiCalls[0].arguments[2]).toBe(50);
    mw.dispose();
  });

  it('uses the first definition with forward declarations and rejects duplicate prototype names', () => {
    const { mw, editor } = createWorkspace();
    const source =
      'double helper(double A);\nvoid element() { double result=helper(12); }\ndouble helper(double A) { return A*2; }';
    mw.start();
    editor.type(source, 1);
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('result')).toBe(24);
    expect(mw.functions.names).toEqual(['helper']);
    expect(mw.addFunction('helper')).toBe(false);
    expect(mw.addFunction('switch')).toBe(true);
    expect(editor.text).toContain('void subFunction()');
    mw.cancelFunction();
    mw.dispose();
  });

  it.each(['inline', 'saved', 'attached'])('receives makeFS return values in Main (%s function)', (mode) => {
    const { mw, editor, parameters } = createWorkspace();
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
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);
      expect(mw.session.runtime.evaluateNumericExpression('height')).toBe(height);
      expect(mw.session.runtime.evaluateNumericExpression('assigned')).toBe(height);
      expect(mw.session.runtime.evaluateNumericExpression('cP.z')).toBe(7 + height);
      expect(mw.session.runtime.evaluateNumericExpression('mainH')).toBe(5);
      const tube = mw.session.lastResult.apiCalls.find((call) => call.name === 'makeVerySimpleTube');
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
    expect(mw.session.runtime.evaluateNumericExpression('cP.z')).toBe(500);
    mw.selectFunction('');
    mw.buildPreview();
    checkMain(120);
    mw.dispose();
  });

  it('routes errors in a saved dependency to its own editor and source line', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type('void element() {}', 1);
    mw.buildPreview();
    mw.addFunction('leaf');
    editor.type('void leaf() {\n double value=missing;\n}', 1);
    mw.saveFunction();
    mw.addFunction('branch');
    editor.type('void branch() { leaf(); }', 1);
    mw.buildPreview();
    const error = mw.session.feedback.externalDiagnostics?.[0];
    expect(error).toMatchObject({ name: 'leaf', line: 2, message: 'unknown variable: missing' });
    expect(mw.session.feedback.diagnostics).toEqual([]);
    mw.selection.onApiTraceSourceActivated(error!.sourceLine);
    expect(mw.functions.active).toBe('leaf');
    expect(editor.currentLine()).toBe(2);
    expect(editor.text).toContain('double value=missing');
    mw.dispose();
  });

  it('keeps unconfirmed parameters out of the built preview when returning from another function tab', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    editor.type('void element() { double D=100; get_val("D", D); }\nvoid helper() {}', 1);
    mw.buildPreview();
    parameters.edit(0, 3);
    parameters.editorTextEdited('150');
    parameters.commitEditor();
    mw.selectFunction('helper');
    mw.selectFunction('');
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(100);
    expect(parameters.values().get('element::D')).toBe('150');
    expect(mw.session.previewDirty).toBe(true);
    expect(mw.session.buildNumber).toBe(1);
    mw.applyParameters();
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(150);
    expect(mw.session.previewDirty).toBe(false);
    mw.dispose();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionWorkspace, sourceFunctions } from '@/entities/source-function';
import { FunctionEditor, SubParameterPanel } from '@/features/manage-functions';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createWorkspace } from '@tests/pages/workspace/harness';

describe('Workspace: source files and sub-function debugging', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders source-file tabs with + and editable boolean arrays', () => {
    const { mw } = createWorkspace();
    const tabs = renderToStaticMarkup(
      createElement(FunctionEditor.Provider, {
        state: { active: 'helpers.cpp', names: ['helpers.h', 'helpers.cpp'], error: '' },
        actions: {
          create: { add: mw.addSourceFiles, clearError: mw.clearFunctionError },
          current: { remove: mw.deleteSourceFile },
          select: mw.selectSourceFile,
        },
        children: createElement(FunctionEditor.Tabs),
      }),
    );
    expect(tabs).toContain('Main.cpp');
    expect(tabs).toContain('helpers.h');
    expect(tabs).toContain('aria-label="Add source files"');
    expect(tabs).not.toContain('Add Function');
    const fn = sourceFunctions('void helper(bool sides[]) {}')[0];
    const inputs = renderToStaticMarkup(
      createElement(SubParameterPanel, {
        enabled: true,
        functions: [{ ...fn, inputs: fn.inputs.map((input) => ({ ...input, values: ['{true, false, true, true}'] })) }],
        active: 'helper',
        select: mw.selectFunctionInputs,
        change: mw.setFunctionInput,
        apply: mw.applyFunctionInputs,
        reset: mw.resetFunctionInputs,
      }),
    );
    expect(inputs).toContain('aria-label="helper.sides"');
    expect(inputs).toContain('value="4"');
    expect(inputs).toContain('{true, false, true, true}');
    expect(inputs).not.toContain('Unsupported preview input');
    mw.dispose();
  });

  it('links header defaults and globals to multiple CPP definitions without changing Main', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    const main = 'void element() { double result=part(3); part(FdPoint3d(1,2,3)); }';
    editor.type(main, 1);
    expect(mw.addSourceFiles('parts', true)).toBe(true);
    expect(mw.functions.fileNames).toEqual(['parts.h', 'parts.cpp']);
    editor.type(
      '#ifndef PARTS_H\n#define PARTS_H\ndouble scale=4;\nclass Creator {\npublic:\n double part(double size, bool enabled=true);\n void part(const FdPoint3d &point, double diameter=6);\n};\n#endif',
      1,
    );
    mw.selectSourceFile('parts.cpp');
    editor.type(
      'double Creator::part(double value, bool flag) { return flag ? value*scale : 0; }\nvoid Creator::part(const FdPoint3d &center, double d) { makeFlatDisc(center, vz, d, 8); }',
      1,
    );
    mw.selectSourceFile('');
    expect(editor.text).toBe(main);
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('result')).toBe(12);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.functions.names).toEqual(['part(double, bool)', 'part(const FdPoint3d&, double)']);
    mw.selectFunction('part(const FdPoint3d&, double)');
    expect(mw.functions.activeFile).toBe('parts.cpp');
    expect(editor.currentLine()).toBe(2);
    expect(mw.functions.inputValues(mw.functions.active, 'd', ['0'])).toEqual(['6']);
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.meshes).toHaveLength(1);
    mw.selectSourceFile('');
    expect(editor.text).toBe(main);
    mw.dispose();
  });

  it.each(['inline', 'cpp'])('keeps helper source and return values (%s)', (mode) => {
    const { mw, editor, parameters } = createWorkspace();
    const main = 'void element() { double D=100; get_val("D",D); double result=helper(3); }';
    const helper =
      'double helper(double x) { double D=20; get_val("D",D); makeFlatDisc(FdPoint3d(),vz,D,8); return D*x; }';
    mw.start();
    const source = mode === 'inline' ? main + '\n' + helper : main;
    editor.type(source, 1);
    if (mode === 'cpp') {
      mw.addSourceFiles('helpers.cpp', false);
      editor.type(helper, 1);
      mw.selectSourceFile('');
    }
    mw.buildPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('result')).toBe(60);
    expect(parameters.tabs.map((tab) => tab.id)).toEqual(['element', 'helper']);
    parameters.selectTab('helper');
    parameters.importTable('D\n30');
    mw.applyParameters();
    expect(mw.session.runtime.evaluateNumericExpression('result')).toBe(90);
    mw.selectFunction('helper');
    expect(editor.text).toBe(mode === 'inline' ? source : helper);
    expect(editor.currentLine()).toBe(mode === 'inline' ? 2 : 1);
    expect(mw.functions.inputValues('helper', 'x', ['0'])).toEqual(['3']);
    expect(mw.session.runtime.evaluateNumericExpression('D')).toBe(30);
    mw.selectFunction('');
    expect(editor.text).toBe(source);
    mw.dispose();
  });

  it('seeds each actual call, isolating array overrides from Main and other calls', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    const source = [
      'double shared=1;',
      'void element() {',
      ' bool sides[]={true,false,true,true};',
      ' shared=20; helper(sides, 3);',
      ' shared=40; sides[1]=true; helper(sides, 5);',
      ' shared=90;',
      '}',
      'void helper(bool flags[], double x) {',
      ' double size=shared+x;',
      ' if(flags[1]) makeFlatDisc(FdPoint3d(), vz, size, 8);',
      ' flags[0]=false;',
      '}',
    ].join('\n');
    editor.type(source, 1);
    mw.buildPreview();
    mw.selectFunction('helper');
    expect(editor.text).toBe(source);
    expect(editor.currentLine()).toBe(8);
    expect(mw.functions.inputValues('helper', 'flags', ['{}'])).toEqual(['{true, false, true, true}']);
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(23);
    expect(mw.session.scene.meshes).toHaveLength(0);
    mw.selectFunctionOccurrence(1);
    expect(mw.functions.inputValues('helper', 'flags', ['{}'])).toEqual(['{false, true, true, true}']);
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(45);
    expect(mw.session.scene.meshes).toHaveLength(1);
    mw.setFunctionInput('helper', 'flags', ['{}'], 0, '{1, 0, 1, 0}');
    mw.setFunctionInput('helper', 'x', ['0'], 0, '12');
    mw.applyFunctionInputs('helper');
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(52);
    expect(mw.session.scene.meshes).toHaveLength(0);
    mw.selectFunctionOccurrence(0);
    expect(mw.functions.inputValues('helper', 'x', ['0'])).toEqual(['3']);
    mw.selectFunctionOccurrence(1);
    mw.resetFunctionInputs('helper');
    mw.applyFunctionInputs('helper');
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(45);
    mw.setFunctionInput('helper', 'flags', ['{}'], 0, 'false, true');
    mw.applyFunctionInputs('helper');
    expect(mw.session.lastResult.diagnostics[0].message).toContain('array input must use braces');
    expect(mw.session.runtime.evaluateNumericExpression('shared')).toBe(40);
    mw.resetFunctionInputs('helper');
    mw.applyFunctionInputs('helper');
    mw.selectFunction('');
    mw.buildPreview();
    expect(mw.session.runtime.evaluateNumericExpression('shared')).toBe(90);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(editor.text).toBe(source);
    mw.dispose();
  });

  it('debugs a nested expression call without leaking future values', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type(
      [
        'double shared=0;',
        'void element() { shared=20; double out=outer(3); shared=90; }',
        'double outer(double x) { return leaf(x+2); }',
        'double leaf(double value) {',
        ' double size=shared+value;',
        ' makeFlatDisc(FdPoint3d(),vz,size,8);',
        ' size=999;',
        ' return size;',
        '}',
      ].join('\n'),
      1,
    );
    mw.buildPreview();
    mw.selectFunction('leaf');
    expect(mw.session.scene.meshes).toHaveLength(1);
    editor.moveTo(5);
    mw.debugPreview();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('shared')).toBe(20);
    expect(mw.session.runtime.evaluateNumericExpression('value')).toBe(5);
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(25);
    expect(mw.session.lastResult.variables.map((v) => v.name)).toContain('value');
    expect(mw.session.scene.meshes).toHaveLength(0);
    editor.moveTo(6);
    vi.advanceTimersByTime(220);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(25);
    expect(mw.subApiTrace.m_tree.topLevelItemCount()).toBe(1);
    mw.dispose();
  });

  it('filters mesh when a top-level script calls a helper after other geometry', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type(
      'double D=100;\nmakeFlatDisc(FdPoint3d(),vz,D,8);\nhelper();\nvoid helper() {makeFlatDisc(FdPoint3d(),vz,D/2,8);}',
      1,
    );
    mw.buildPreview();
    expect(mw.session.scene.meshes).toHaveLength(2);
    mw.selectFunction('helper');
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.lastResult.debugApiIndex).toBe(1);
    expect(mw.session.scene.meshes).toHaveLength(1);
    expect(mw.session.scene.meshes[0].apiIndex).toBe(2);
    mw.dispose();
  });

  it('uses zero inputs for an uncalled helper and accepts bool, numeric and point arrays', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type(
      'void element() {}\nvoid helper(double value=8, FdVector3d axis=vz, bool flags[2], double values[2][2], FdPoint3d points[]) {\n double result=flags[1] ? value+values[1][0]+points[0].z+axis.z : 0;\n}',
      1,
    );
    mw.buildPreview();
    mw.selectFunction('helper');
    expect(mw.functions.inputValues('helper', 'value', ['8'])).toEqual(['0']);
    expect(mw.functions.inputValues('helper', 'axis', ['0', '0', '1'])).toEqual(['0', '0', '0']);
    mw.setFunctionInput('helper', 'flags', ['{false,false}'], 0, '{false,true}');
    mw.setFunctionInput('helper', 'values', ['{}'], 0, '{{1,2},{3,4}}');
    mw.setFunctionInput('helper', 'points', ['{}'], 0, '{FdPoint3d(1,2,7)}');
    mw.applyFunctionInputs('helper');
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.runtime.evaluateNumericExpression('result')).toBe(10);
    mw.setFunctionInput('helper', 'value', ['0'], 0, '');
    mw.applyFunctionInputs('helper');
    expect(mw.functions.error).toBe('Enter a number for value.');
    mw.dispose();
  });

  it('keeps Build frozen during parameter edits and tab switching until OK', () => {
    const { mw, editor, parameters } = createWorkspace();
    mw.start();
    const source =
      'void element() { double D=10; get_val("D",D); helper(D); }\nvoid helper(double x) { makeFlatDisc(FdPoint3d(),vz,x,8); }';
    editor.type(source, 1);
    mw.buildPreview();
    const before = mw.exportObj();
    parameters.edit(
      parameters.rows.findIndex((row) => row.key === 'element::D'),
      3,
    );
    parameters.editorTextEdited('30');
    parameters.commitEditor();
    vi.advanceTimersByTime(1000);
    expect(mw.exportObj()).toBe(before);
    mw.selectFunction('helper');
    expect(mw.functions.inputValues('helper', 'x', ['0'])).toEqual(['10']);
    expect(mw.session.runtime.evaluateNumericExpression('x')).toBe(10);
    mw.selectFunction('');
    expect(mw.exportObj()).toBe(before);
    mw.applyParameters();
    expect(mw.exportObj()).not.toBe(before);
    mw.selectFunction('helper');
    mw.buildPreview();
    expect(mw.functions.inputValues('helper', 'x', ['0'])).toEqual(['30']);
    editor.type(source.replace('vz,x,8', 'vz,x*2,8'), 1);
    const frozen = mw.exportObj();
    vi.advanceTimersByTime(1000);
    expect(mw.session.debugBlocked).toBe(true);
    expect(mw.exportObj()).toBe(frozen);
    mw.buildPreview();
    expect(mw.exportObj()).not.toBe(frozen);
    mw.dispose();
  });

  it('maps diagnostics to the linked CPP and its local line', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type('void element() { leaf(); }', 1);
    mw.addSourceFiles('helpers', true);
    editor.type('void leaf();', 1);
    mw.selectSourceFile('helpers.cpp');
    editor.type('void leaf() {\n double result=missing;\n}', 1);
    mw.selectSourceFile('');
    mw.buildPreview();
    expect(mw.session.feedback.diagnostics).toEqual([]);
    const error = mw.session.feedback.externalDiagnostics![0];
    expect(error).toMatchObject({ name: 'helpers.cpp', line: 2 });
    mw.selection.navigateToSource(error.sourceLine, new Set([error.sourceLine]));
    expect(mw.functions.activeFile).toBe('helpers.cpp');
    expect(editor.currentLine()).toBe(2);
    mw.dispose();
  });

  it('does not seed a newly opened helper from Main code that has not been built', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    const source = 'void element() {helper(4);}\nvoid helper(double x) {makeFlatDisc(FdPoint3d(),vz,x,8);}';
    editor.type(source, 1);
    mw.buildPreview();
    editor.type(source.replace('helper(4)', 'helper(40)'), 1);
    mw.selectFunction('helper');
    expect(mw.functions.inputValues('helper', 'x', ['0'])).toEqual(['4']);
    expect(mw.session.runtime.evaluateNumericExpression('x')).toBe(4);
    expect(mw.session.debugBlocked).toBe(true);
    mw.buildPreview();
    expect(mw.session.runtime.evaluateNumericExpression('x')).toBe(40);
    mw.dispose();
  });

  it('validates names, protects Main and removes only the selected file', () => {
    const ws = new FunctionWorkspace();
    ws.edit('void main() {}');
    expect(ws.removeFile()).toBeNull();
    expect(ws.addFiles('../helpers', false)).toBe(false);
    expect(ws.addFiles('helpers', true)).toBe(true);
    expect(ws.addFiles('helpers.cpp', false)).toBe(false);
    ws.selectFile('helpers.cpp');
    ws.edit('void helper(double x) {}\nvoid other() {}');
    expect(ws.names).toEqual(['helper', 'other']);
    expect(ws.removeFile()).toBe('helpers.cpp');
    expect(ws.names).toEqual([]);
    expect(ws.fileNames).toEqual(['helpers.h']);
    expect(ws.mainSource).toBe('void main() {}');
  });

  it.each([
    ['const FdPoint3d &p', 'FdPoint3d const &q', 'part(const FdPoint3d&)'],
    ['double values[3]', 'double* other', 'part(double*)'],
    ['const double value=1', 'ads_real other', 'part(double)'],
  ])('recognizes equivalent overload signatures %s and %s', (first, second, signature) => {
    expect(sourceFunctions(`void part(${first}) {}`)[0].signature).toBe(signature);
    expect(sourceFunctions(`void part(${second}) {}`)[0].signature).toBe(signature);
  });
});

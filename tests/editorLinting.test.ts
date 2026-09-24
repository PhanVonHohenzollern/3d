import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  executionDiagnostics,
  executionDiagnosticsField,
  lintCppSyntax,
  setExecutionDiagnostics,
} from '../src/hooks/codeEditor/linting';

describe('CodeMirror C++ syntax diagnostics', () => {
  it('locates runtime errors and discards stale diagnostics when the source changes', () => {
    const source = 'double width = 5;\nwidth = missingValue;';
    const errors = executionDiagnostics(source, [{ line: 2, message: 'unknown variable: missingValue' }]);
    expect(source.slice(errors[0].from, errors[0].to)).toBe('missingValue');
    let state = EditorState.create({ doc: source, extensions: [executionDiagnosticsField] });
    state = state.update({ effects: setExecutionDiagnostics.of(errors) }).state;
    expect(state.field(executionDiagnosticsField)).toHaveLength(1);
    state = state.update({ changes: { from: errors[0].from, to: errors[0].to, insert: '12' } }).state;
    expect(state.field(executionDiagnosticsField)).toEqual([]);
  });

  it('accepts the preview dialect with top-level geometry calls', () => {
    expect(
      lintCppSyntax('double width = 50;\nget_val("Width", width);\nFdPoint3d p(0,0,0);\nmakeFlatDisc(p, vz, 40, 1);'),
    ).toEqual([]);
  });

  it('reports an incomplete expression with an in-bounds highlight', () => {
    const code = 'double width = ;';
    const diagnostics = lintCppSyntax(code);
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.severity).toBe('error');
      expect(diagnostic.from).toBeGreaterThanOrEqual(0);
      expect(diagnostic.to).toBeLessThanOrEqual(code.length);
      expect(diagnostic.to).toBeGreaterThan(diagnostic.from);
    }
  });

  it('checks errors at the end of the entire document', () => {
    const prefix = '// valid line\n'.repeat(1000);
    const diagnostics = lintCppSyntax(prefix + 'double width = ;');
    expect(diagnostics.some((diagnostic) => diagnostic.from >= prefix.length)).toBe(true);
  });

  it('clears errors after the source is corrected', () => {
    expect(lintCppSyntax('double width = ;').length).toBeGreaterThan(0);
    expect(lintCppSyntax('double width = 50;')).toEqual([]);
  });

  it('does not treat delimiters inside strings or comments as syntax errors', () => {
    expect(lintCppSyntax('const char* label = "{[("; // }])\n/* { */')).toEqual([]);
    expect(lintCppSyntax('')).toEqual([]);
  });

  it('does not execute code or claim to resolve unknown functions', () => {
    expect(lintCppSyntax('while (true) {}\nunknownFunction();')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '../src/core/runtime/GeometryRuntime';
import { PreviewGeometryEngine } from '../src/core/geometry/PreviewGeometryEngine';
import { preprocess } from '../src/core/runtime/helpers/preprocessor';
import {
  declaredFunctionNames,
  mainFunctionName,
  removeFunctionSource,
  sourceFunctions,
  validFunctionCode,
} from '../src/helpers/functions';
import { FunctionWorkspace } from '../src/hooks/mainWindow/FunctionWorkspace';

describe('vendor C++ compatibility regressions', () => {
  const conditionalSource = [
    '\uFEFF#define FIX_BRX',
    '#define SCALE(x) \\',
    '  ((x) * 2)',
    '#if 0',
    'void inactive() { invalid syntax {',
    '#else',
    'short Vendor::makeElement() {',
    '  double length = SCALE(25);',
    '#ifdef FIX_BRX',
    '  if (length > 0) {',
    '#else',
    '  if (length < 0) {',
    '#endif',
    '    makeVerySimpleTube(FdPoint3d(), FdPoint3d(0, 0, length), 20, 8);',
    '  }',
    '  return 0;',
    '}',
    '#endif',
    'void helper();',
    'void helper() {}',
  ].join('\r\n');

  it('discovers active functions and preserves original offsets through directives, comments, BOM and CRLF', () => {
    const masked = preprocess(conditionalSource).maskedCode;
    expect(masked.length).toBe(conditionalSource.length);
    expect(masked.split('\n').map((line) => line.length)).toEqual(
      conditionalSource.split('\n').map((line) => line.length),
    );
    const functions = sourceFunctions(conditionalSource);
    expect(functions.map((fn) => fn.name)).toEqual(['makeElement', 'helper']);
    for (const fn of functions) expect(conditionalSource.slice(fn.from, fn.to)).toBe(fn.code);
    expect(functions[0].code).toContain('#ifdef FIX_BRX');
    expect(mainFunctionName(conditionalSource)).toBe('makeElement');
    expect(declaredFunctionNames(conditionalSource)).toEqual(new Set(['helper']));
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(conditionalSource, 999, true, { entryFunction: functions[0].name });
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('length')).toBe(50);
    expect(new PreviewGeometryEngine().build(result).meshes).toHaveLength(1);
  });

  it('removes only the selected function and its declaration after conditional code', () => {
    const edited = removeFunctionSource(conditionalSource, 'helper');
    expect(sourceFunctions(edited).map((fn) => fn.name)).toEqual(['makeElement']);
    expect(edited).toContain('#ifdef FIX_BRX');
    expect(edited).not.toContain('void helper');
  });

  it('creates function tabs from a source containing inactive syntax', () => {
    const workspace = new FunctionWorkspace();
    workspace.edit(conditionalSource);
    expect(workspace.names).toEqual(['helper']);
    expect(workspace.program().options.entryFunction).toBe('makeElement');
    expect(() => sourceFunctions('void helper() {}\n#if')).not.toThrow();
    expect(validFunctionCode(sourceFunctions(conditionalSource)[0].code)).toBeNull();
  });

  it('initializes and assigns points/vectors with braces and preserves their trace values', () => {
    const source = [
      'void makeElement() {',
      '  FdPoint3d start = {1, 2, 3};',
      '  FdVector3d normal{0, 0, 1};',
      '  FdVector3d normals[2] = {{1, 0, 0}, {0, 1, 0}};',
      '  FdPoint3d origin = {};',
      '  FdVector3d copy = {normal};',
      '  normal = {0, 1, 0,};',
      '  normals[0] = {0, 0, 1};',
      '  start = {4, 5, 6};',
      '  double x = 2; x = {3};',
      '  makeVerySimpleTube(start, start + normals[0] * 50, 20, 8);',
      '}',
    ].join('\n');
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(source, 999, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('start.z')).toBe(6);
    expect(runtime.evaluateNumericExpression('origin.x')).toBe(0);
    expect(runtime.evaluateNumericExpression('copy.z')).toBe(1);
    expect(runtime.evaluateNumericExpression('normal.y')).toBe(1);
    expect(runtime.evaluateNumericExpression('normals[0].z')).toBe(1);
    expect(runtime.evaluateNumericExpression('x')).toBe(3);
    expect(result.variableChanges.find((change) => change.line === 9)).toMatchObject({
      name: 'start',
      before: { x: 1, y: 2, z: 3 },
      after: { x: 4, y: 5, z: 6 },
    });
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0].vertices.every((v) => Object.values(v).every(Number.isFinite))).toBe(true);
    const partial = runtime.executeUpToLine(source, 6);
    expect(partial.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('start.z')).toBe(3);
  });

  it.each(['FdPoint3d p = {1, 2};', 'FdVector3d v = {1, 2, 3, 4};'])('rejects invalid constructors: %s', (code) => {
    const result = new GeometryRuntime().executeUpToLine(code, 999, true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain('unsupported direct initializer');
  });

  it.each(['BlockCreator3d', 'FLM3Geo::BlockCreator3d'])(
    'dispatches %s calls to the SDK even when a helper shadows the API',
    (scope) => {
      const source = [
        'short makeElement() { makeVerySimpleTube(20); return 0; }',
        'void makeVerySimpleTube(double diameter) {',
        `  ${scope}::makeVerySimpleTube(FdPoint3d(), FdPoint3d(0, 0, 50), diameter, 8);`,
        '}',
      ].join('\n');
      const result = new GeometryRuntime().executeUpToLine(source, 999, true);
      expect(result.diagnostics).toEqual([]);
      expect(result.apiCalls.map((call) => [call.name, call.userFunctionCall, call.line, call.parentApiIndex])).toEqual(
        [
          ['makeVerySimpleTube', true, 1, -1],
          ['makeVerySimpleTube', false, 3, 0],
        ],
      );
      const scene = new PreviewGeometryEngine().build(result);
      expect(scene.meshes).toHaveLength(1);
      expect(scene.warnings).toEqual([]);
    },
  );

  it('does not treat unrelated scopes as SDK calls', () => {
    const result = new GeometryRuntime().executeUpToLine('Other::makeVerySimpleTube();', 999, true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.apiCalls).toEqual([]);
  });

  it('evaluates mutating methods inside geometry arguments without treating the API name as a variable', () => {
    const source = [
      'FdPoint3d p(10, 0, 0);',
      'makeScrew(p.rotateBy(ARX_PI / 2, vz), vz, vx, 6, 10, true, true);',
      'FdVector3d normals[1] = { FdVector3d(0, 0, 2) };',
      'makeFlatDisc(p, normals[0].normalize(), 20, 8);',
    ].join('\n');
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(source, 999, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('p.x')).toBeCloseTo(0);
    expect(runtime.evaluateNumericExpression('p.y')).toBeCloseTo(10);
    expect(runtime.evaluateNumericExpression('normals[0].z')).toBe(1);
    expect(result.apiCalls.map((call) => call.name)).toEqual(['makeScrew', 'makeFlatDisc']);
    expect(result.variableChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'p', operation: 'rotateBy', line: 2 }),
        expect.objectContaining({ name: 'normals[0]', operation: 'normalize', line: 4 }),
      ]),
    );
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes.length).toBeGreaterThan(1);
  });
});

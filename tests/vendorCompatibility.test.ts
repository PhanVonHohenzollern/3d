import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import { PreviewGeometryEngine } from '@engine/geometry/PreviewGeometryEngine';
import { preprocess } from '@engine/runtime/helpers/preprocessor';
import {
  declaredFunctionNames,
  mainFunctionName,
  removeFunctionSource,
  sourceFunctions,
  validFunctionCode,
} from '@/helpers/functions';
import { FunctionWorkspace } from '@/hooks/mainWindow/FunctionWorkspace';
import { RuntimeStdVector } from '@engine/runtime/RuntimeValue';

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

  it.each(['CHAR', 'char', 'WCHAR'])('reads %s pointer parameters initialized with NULL', (type) => {
    const code = `void element() {
      ${type}* direction = NULL;
      bool initiallyEmpty = !direction;
      get_val("a_direction", direction);
      double angle = 0;
      if (direction && strcmp(direction, "3h") == 0) angle = ARX_PI / 2;
      makeSymbolicLine(FdPoint3d(), FdPoint3d(10, 0, 0).rotateBy(angle, vz));
    }`;
    const runtime = new GeometryRuntime();
    expect(runtime.discoverParameters(code)).toEqual([
      expect.objectContaining({ name: 'a_direction', type: 'string', defaultValue: '' }),
    ]);
    runtime.setParameters(new Map([['a_direction', '3h']]));
    const result = runtime.executeUpToLine(code, 999, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('initiallyEmpty')).toBe(1);
    expect(result.apiCalls[0].arguments[1]).toMatchObject({ y: 10, z: 0 });
    expect(result.parameterRequests[0]).toMatchObject({ type: 'string', currentValue: '"3h"' });
  });

  it('draws a closed outline through nested helpers using copied std::vector points', () => {
    const code = `void element() { makeHoles(FdPoint3d(10, 20, 0)); }
      void makeHoles(const FdPoint3d& center) { makeOutline(center); }
      void makeOutline(const FdPoint3d& center) {
        std::vector<FdPoint3d> points;
        FdPoint3d p = center + vx * 5;
        for (int i = 0; i < 4; ++i) {
          points.push_back(p);
          p.rotateBy(ARX_PI / 2, vz, center);
        }
        for (int i = 0; i < points.size() - 1; ++i)
          makeSymbolicLine(points[i], points[i + 1]);
        makeSymbolicLine(points.front(), points.back());
      }`;
    const workspace = new FunctionWorkspace();
    workspace.edit(code);
    expect(workspace.names).toEqual(['makeHoles', 'makeOutline']);
    const program = workspace.program();
    const result = new GeometryRuntime().executeUpToLine(program.source, 999, true, program.options);
    expect(result.diagnostics).toEqual([]);
    const lines = result.apiCalls.filter((call) => call.name === 'makeSymbolicLine');
    expect(lines).toHaveLength(4);
    const vertices = [
      [15, 20],
      [10, 25],
      [5, 20],
      [10, 15],
    ];
    lines.forEach((line, i) => {
      const endpoints = i === 3 ? [vertices[0], vertices[3]] : [vertices[i], vertices[i + 1]];
      endpoints.forEach(([x, y], j) => {
        const point = line.arguments[j] as { x: number; y: number; z: number };
        expect(point.x).toBeCloseTo(x);
        expect(point.y).toBeCloseTo(y);
        expect(point.z).toBe(0);
      });
    });
    const pushes = result.variableChanges.filter((change) => change.operation === 'push_back');
    expect(pushes.map((change) => (change.after as RuntimeStdVector).elements.length)).toEqual([1, 2, 3, 4]);
    expect((pushes[0].after as RuntimeStdVector).elements[0]).toMatchObject({ x: 15, y: 20 });
    const scene = new PreviewGeometryEngine().build(result);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(4);
  });

  it('preserves vector copy, reference, overload and element mutation semantics', () => {
    const code = `void element() {
      std::vector<FdPoint3d> points = {{1, 2, 3}};
      std::vector<FdPoint3d> copy(points);
      std::vector<FdPoint3d> assigned;
      assigned = points;
      append(points);
      points.front().set(4, 5, 6);
      points.back().z = 9;
      makeSymbolicLine(points.front(), points.back());
      std::vector<int> numbers(2, 7);
      int count = pick(numbers);
      int pointCount = pick(points);
      bool untouched = copy.front().x == 1 && assigned.front().x == 1;
      bool skipped = false && (numbers.push_back(100), true);
    }
    void append(std::vector<FdPoint3d>& out) { out.push_back(FdPoint3d(7, 8, 3)); }
    int pick(const std::vector<int>& values) { return values.size(); }
    int pick(const std::vector<FdPoint3d>& values) { return values.size(); }`;
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(code, 999, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('count')).toBe(2);
    expect(runtime.evaluateNumericExpression('pointCount')).toBe(2);
    expect(runtime.evaluateNumericExpression('untouched')).toBe(1);
    expect(runtime.evaluateNumericExpression('numbers[0]')).toBe(7);
    expect(runtime.evaluateNumericExpression('numbers.size()')).toBe(2);
    const line = result.apiCalls.find((call) => call.name === 'makeSymbolicLine')!;
    expect(line.arguments).toEqual([
      expect.objectContaining({ x: 4, y: 5, z: 6 }),
      expect.objectContaining({ x: 7, y: 8, z: 9 }),
    ]);
  });

  it.each([
    ['std::vector<int> points; points.front();', 'non-empty vector'],
    ['std::vector<int> points; points.back();', 'non-empty vector'],
    ['std::vector<int> points; points[0];', 'array index out of range'],
    ['std::vector<int> points; points.size(1);', 'takes no arguments'],
    ['std::vector<int> points; points.push_back();', 'requires one element'],
    ['std::vector<FdPoint3d> points; points.push_back(1);', 'FdPoint3d value required'],
    ['std::vector<int> points(-1);', 'array dimensions'],
    ['std::vector<int> points(1000001);', 'at most 1000000 elements'],
    ['std::vector<int> points; std::vector<double> other; points = other;', 'std::vector<int> value required'],
  ])('reports invalid vector operations: %s', (code, message) => {
    const result = new GeometryRuntime().executeUpToLine(code, 999, true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain(message);
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

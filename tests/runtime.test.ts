import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GeometryRuntime } from '@/core/runtime/GeometryRuntime';
import { encodeParameterRequest, encodeResult } from '@tests/support/codec';
import { expectSameJson } from '@tests/support/compare';
import { evaluations, sourceHistories } from '@tests/support/dump';
import { expectedOutput } from '@tests/support/expected';
import { fixturesRoot, listFixtures, parseFixture } from '@tests/support/fixtures';

describe('C++ function and block scopes', () => {
  it('resolves overloads by argument count and type, including default arguments and nested return values', () => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      `void element() {
int a=pick(2); double b=pick(2.0); double c=pick(FdPoint3d(1,2,3));
double d=pick(FdVector3d(1,2,3)); double e=pick(true); double f=pick("hello");
double g=pick(2.0,3.0); double nested=pick(pick(2));
}
double pick(double value) { return 20; }
int pick(int value) { return 10; }
double pick(FdPoint3d p) { return p.z; }
double pick(FdVector3d v) { return v.x; }
double pick(bool flag) { return 5; }
double pick(const char* text) { return 6; }
double pick(double x,double y,double z=4) { return x+y+z; }`,
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'nested'].map((name) => runtime.evaluateNumericExpression(name)),
    ).toEqual([10, 20, 3, 1, 5, 6, 9, 10]);
  });

  it.each([
    ['pick();', 'ambiguous overload: pick'],
    ['pick(FdPoint3d());', 'no matching overload: pick'],
  ])('reports invalid overload selection for %s', (call, error) => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      `void element() { ${call} }
double pick(double value=1) { return 1; }
double pick(int value=1) { return 2; }`,
      999,
      true,
    );
    expect(result.diagnostics).toEqual([{ line: 1, message: error }]);
  });

  it('preserves a nested helper global write even when the caller shadows that global', () => {
    const source = [
      'double D=1;',
      'void setGlobal() { D=5; }',
      'void helper() { double D=99; setGlobal(); }',
      'void main() { D=3; { double D=20; helper(); } double after=D; }',
    ].join('\n');
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(source, 999, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('D')).toBe(5);
    expect(runtime.evaluateNumericExpression('after')).toBe(5);
    expect(result.variables.find((variable) => variable.name === 'D')?.lastChangedLine).toBe(2);
  });
  it('separates get_val keys, restores shadowed locals, and preserves global and reference writes', () => {
    const source = [
      'double total = 1;',
      'double helper(double &out) {',
      ' double D = 20; get_val("D", D);',
      ' { double D = 99; total += D; }',
      ' out = D; return D;',
      '}',
      'short makeDV() {',
      ' double D = 100; get_val("D", D);',
      ' double result = 0; double height = helper(result);',
      ' double finalD = D;',
      '}',
    ].join('\n');
    const runtime = new GeometryRuntime();
    runtime.setParameters(
      new Map([
        ['makeDV::D', '120'],
        ['helper::D', '30'],
      ]),
    );
    const result = runtime.executeUpToLine(source, 999, true);
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('D')).toBe(120);
    expect(runtime.evaluateNumericExpression('height')).toBe(30);
    expect(runtime.evaluateNumericExpression('result')).toBe(30);
    expect(runtime.evaluateNumericExpression('total')).toBe(100);
    expect(result.parameterRequests.map((p) => [p.functionName, p.name, p.currentValue])).toEqual([
      ['makeDV', 'D', '120'],
      ['helper', 'D', '30'],
    ]);
  });

  it('does not expose a caller local in a callee or a loop variable outside its scope', () => {
    const source =
      'double helper() { return hidden; }\nvoid main() { double hidden = 5; helper(); for(int i=0;i<2;i++){} double bad=i; }';
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(source, 999, true);
    expect(result.diagnostics.map((d) => d.message)).toEqual(['unknown variable: hidden', 'unknown variable: i']);
    expect(runtime.evaluateNumericExpression('hidden')).toBe(5);
    const script = runtime.executeUpToLine(
      'double helper(){return hidden;}\n{ double hidden=5; helper(); }',
      999,
      true,
    );
    expect(script.diagnostics.map((d) => d.message)).toEqual(['unknown variable: hidden']);
    expect(script.apiCalls).toHaveLength(1);
  });

  it('supports the character arithmetic and string length used by the DV helpers', () => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      "char* zxd = \"6x8\"; double n = zxd[0] - '0'; double d = zxd[2] - '0'; int len = strlen(zxd);",
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('n')).toBe(6);
    expect(runtime.evaluateNumericExpression('d')).toBe(8);
    expect(runtime.evaluateNumericExpression('len')).toBe(3);
  });
});

describe('C++ declarations and values', () => {
  it('closes nested std::vector templates written with >> while keeping >> as a shift', () => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      [
        'std::vector<std::vector<double>> grid; std::vector<double> row; row.push_back(2.5); grid.push_back(row);',
        'std::vector<std::vector<std::vector<int>>> cube;',
        'double cell = grid[0][0]; int half = 8 >> 1;',
      ].join('\n'),
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(runtime.evaluateNumericExpression('cell')).toBe(2.5);
    expect(runtime.evaluateNumericExpression('half')).toBe(4);
    expect(result.variables.map((variable) => variable.name)).toContain('cube');
  });

  it('applies bowl methods to the stored object through arrays, members and references', () => {
    const runtime = new GeometryRuntime();
    const result = runtime.executeUpToLine(
      [
        'FdBowlInfo infos[2]; infos[0].setCornersNum(7);',
        'int changed = infos[0].getCornersNum(); int untouched = infos[1].getCornersNum();',
        'infos[0].getFace(1).setCovered(true); bool covered = infos[0].getFace(1).isCovered();',
        'FdBowlInfo copy = infos[0]; copy.setCornersNum(3); int original = infos[0].getCornersNum();',
        'std::vector<FdBowlInfo> list; list.push_back(copy); list.front().setCornersNum(9); int front = list[0].getCornersNum();',
      ].join('\n'),
      999,
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(
      ['changed', 'untouched', 'covered', 'original', 'front'].map((name) => runtime.evaluateNumericExpression(name)),
    ).toEqual([7, 4, 1, 7, 9]);
    expect(result.variableChanges.some((change) => change.name === 'infos[0]' && change.line === 1)).toBe(true);
  });

  it('rejects a >> that closes more template levels than were opened', () => {
    const result = new GeometryRuntime().executeUpToLine('std::vector<double>> bad;', 999, true);
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe('fixture line endings', () => {
  it.each(['\n', '\r\n'])('keeps both empty eval directives with %j line endings', (eol) => {
    const file = path.join(fixturesRoot, 'runtime', 'runtime_errors.cpp');
    const source = fs.readFileSync(file, 'utf8').replace(/\r?\n/g, eol);
    const read = vi.spyOn(fs, 'readFileSync').mockReturnValueOnce(source);
    try {
      const fixture = parseFixture(file);
      expect(fixture.evals).toHaveLength(13);
      expect(fixture.evals.slice(5, 8)).toEqual(['', '', 'sqrt(-1)']);
      expect(fixture.lines).toEqual([999]);
    } finally {
      read.mockRestore();
    }
  });
});

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('runtime output matches', () => {
      const expected = expectedOutput(fixture);
      const runtime = new GeometryRuntime();
      expectSameJson(expected.discoverParameters, runtime.discoverParameters(fixture.code).map(encodeParameterRequest));
      fixture.lines.forEach((line, index) => {
        runtime.setParameters(fixture.parameters);
        const result = runtime.executeUpToLine(fixture.code, line);
        const run = expected.runs[index];
        expectSameJson(
          { line: run.line, result: run.result, sourceHistories: run.sourceHistories, evals: run.evals },
          {
            line,
            result: encodeResult(result),
            sourceHistories: sourceHistories(result),
            evals: evaluations(runtime, fixture.evals),
          },
        );
      });
    });
  });
}

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GeometryRuntime } from '../src/core/runtime/GeometryRuntime';
import { encodeParameterRequest, encodeResult } from './support/codec';
import { expectSameJson } from './support/compare';
import { evaluations, sourceHistories } from './support/dump';
import { expectedOutput } from './support/expected';
import { fixturesRoot, listFixtures, parseFixture } from './support/fixtures';

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

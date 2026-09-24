import { describe, it } from 'vitest';
import { GeometryRuntime } from '../src/core/runtime/GeometryRuntime';
import { encodeParameterRequest, encodeResult } from './support/codec';
import { expectSameJson } from './support/compare';
import { evaluations, sourceHistories } from './support/dump';
import { expectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

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

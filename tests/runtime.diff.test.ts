// Differential test: TypeScript GeometryRuntime vs the original C++ runtime.
import { describe, it } from 'vitest';
import { GeometryRuntime, runtimeSourceHistory } from '../src/runtime/GeometryRuntime';
import type { RuntimeArgumentTrace, RuntimeResult } from '../src/runtime/RuntimeTypes';
import { what } from '../src/runtime/CppCompat';
import { encodeNumber, encodeParameterRequest, encodeResult } from './support/codec';
import { expectSameJson } from './support/compare';
import { listFixtures } from './support/fixtures';
import { referenceOutput } from './support/reference';

function sourceHistories(result: RuntimeResult): number[][] {
  const histories: number[][] = [];
  const collect = (t: RuntimeArgumentTrace) => {
    for (const s of t.sources) histories.push(runtimeSourceHistory(result, s));
    t.elements.forEach(collect);
  };
  for (const call of result.apiCalls) call.argumentTraces.forEach(collect);
  return histories;
}

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('matches the C++ runtime', () => {
      const reference = referenceOutput(fixture);
      const runtime = new GeometryRuntime();
      expectSameJson(
        reference.discoverParameters,
        runtime.discoverParameters(fixture.code).map(encodeParameterRequest),
      );
      fixture.lines.forEach((line, index) => {
        runtime.setParameters(fixture.parameters);
        const result = runtime.executeUpToLine(fixture.code, line);
        const expected = reference.runs[index];
        const actual = {
          line,
          result: encodeResult(result),
          sourceHistories: sourceHistories(result),
          evals: fixture.evals.map((expression) => {
            try {
              return { expression, value: encodeNumber(runtime.evaluateNumericExpression(expression)), error: null };
            } catch (e) {
              return { expression, value: null, error: what(e) };
            }
          }),
        };
        expectSameJson(
          {
            line: expected.line,
            result: expected.result,
            sourceHistories: expected.sourceHistories,
            evals: expected.evals,
          },
          actual,
        );
      });
    });
  });
}

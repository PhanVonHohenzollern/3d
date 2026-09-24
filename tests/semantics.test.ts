import { describe, it } from 'vitest';
import { decodeResult, type Json } from './support/codec';
import { expectSameJson } from './support/compare';
import { callInfo } from './support/dump';
import { expectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('API metadata, semantics and debug anchors match', () => {
      expectedOutput(fixture).runs.forEach((run: Json) => {
        const result = decodeResult(run.result);
        expectSameJson(
          { line: run.line, callInfo: run.callInfo },
          { line: run.line, callInfo: result.apiCalls.map(callInfo) },
        );
      });
    });
  });
}

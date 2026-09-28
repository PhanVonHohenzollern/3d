import { describe, it } from 'vitest';
import { decodeResult, type Json } from '@tests/support/codec';
import { expectSameJson } from '@tests/support/compare';
import { callInfo } from '@tests/support/dump';
import { expectedOutput } from '@tests/support/expected';
import { listFixtures } from '@tests/support/fixtures';

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

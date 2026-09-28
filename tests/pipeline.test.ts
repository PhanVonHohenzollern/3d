import { describe, it } from 'vitest';
import { expectSameJson } from '@tests/support/compare';
import { dumpFixture } from '@tests/support/dump';
import { expectedOutput } from '@tests/support/expected';
import { listFixtures } from '@tests/support/fixtures';

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('full pipeline matches', () => expectSameJson(expectedOutput(fixture), dumpFixture(fixture)));
  });
}

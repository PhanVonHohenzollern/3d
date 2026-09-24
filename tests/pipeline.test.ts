import { describe, it } from 'vitest';
import { expectSameJson } from './support/compare';
import { dumpFixture } from './support/dump';
import { expectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

for (const fixture of listFixtures()) {
  describe(fixture.name, () => {
    it('full pipeline matches', () => expectSameJson(expectedOutput(fixture), dumpFixture(fixture)));
  });
}

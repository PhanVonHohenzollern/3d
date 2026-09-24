import { it } from 'vitest';
import { dumpFixture } from './support/dump';
import { writeExpectedOutput } from './support/expected';
import { listFixtures } from './support/fixtures';

const updating = process.env.npm_lifecycle_event === 'update-expected';

for (const fixture of listFixtures())
  it.skipIf(!updating)(`writes ${fixture.name}`, () => writeExpectedOutput(fixture, dumpFixture(fixture)));

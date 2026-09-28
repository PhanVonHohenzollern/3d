import { it } from 'vitest';
import { dumpFixture } from '@tests/support/dump';
import { writeExpectedOutput } from '@tests/support/expected';
import { listFixtures } from '@tests/support/fixtures';

const updating = process.env.npm_lifecycle_event === 'update-expected';

for (const fixture of listFixtures())
  it.skipIf(!updating)(`writes ${fixture.name}`, () => writeExpectedOutput(fixture, dumpFixture(fixture)));

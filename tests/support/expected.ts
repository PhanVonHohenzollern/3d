import fs from 'node:fs';
import zlib from 'node:zlib';
import type { Fixture } from './fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExpectedDocument = any;

export const expectedPath = (fixture: Fixture) => fixture.file.replace(/\.cpp$/, '.expected.json.gz');

export function expectedOutput(fixture: Fixture): ExpectedDocument {
  const file = expectedPath(fixture);
  if (!fs.existsSync(file))
    throw new Error(`${fixture.name} has no expected output yet: run \`npm run update-expected\``);
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
}

export function writeExpectedOutput(fixture: Fixture, document: ExpectedDocument) {
  fs.writeFileSync(expectedPath(fixture), zlib.gzipSync(JSON.stringify(document), { level: 9 }));
}

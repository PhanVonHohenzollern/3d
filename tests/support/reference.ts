// Runs the C++ reference harness (reference/harness.cpp), rebuilding it when
// the harness or any original C++ runtime/geometry source is newer.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { webRoot, type Fixture } from './fixtures';

const harness = path.join(webRoot, 'reference', 'build', 'harness');
const cppRoot = path.resolve(webRoot, '..');

function newestSourceTime(): number {
  const sources = [path.join(webRoot, 'reference', 'harness.cpp')];
  for (const dir of ['runtime', 'geometry']) {
    for (const name of fs.readdirSync(path.join(cppRoot, dir)))
      if (/\.(cpp|h|inc)$/.test(name)) sources.push(path.join(cppRoot, dir, name));
  }
  return Math.max(...sources.map((s) => fs.statSync(s).mtimeMs));
}

let checked = false;
function ensureHarness() {
  if (checked) return;
  checked = true;
  if (fs.existsSync(harness) && fs.statSync(harness).mtimeMs >= newestSourceTime()) return;
  execFileSync('sh', [path.join(webRoot, 'reference', 'build.sh')], { stdio: 'inherit' });
}

// Reference JSON document; see reference/harness.cpp for the shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReferenceDocument = any;

const cache = new Map<string, ReferenceDocument>();

export function referenceOutput(fixture: Fixture): ReferenceDocument {
  const cached = cache.get(fixture.file);
  if (cached) return cached;
  ensureHarness();
  const out = execFileSync(harness, [fixture.file], { maxBuffer: 1 << 30, encoding: 'utf8' });
  const doc = JSON.parse(out);
  cache.set(fixture.file, doc);
  return doc;
}

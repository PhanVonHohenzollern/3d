#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || '.');
const revision = 'FLM_CPP_TYPES_CORE_20261017';
const checks = [
  [
    'engine/runtime/helpers/typeNames.ts',
    (s) => s.includes('CPP_TYPE_PARSER_REVISION') && s.includes(revision),
    'C++ multi-token type grammar',
  ],
  [
    'engine/runtime/interpreter/DeclarationEvaluator.ts',
    (s) => s.includes('CPP_TYPE_PARSER_REVISION') && s.includes('legacyLongDouble'),
    'DeclarationEvaluator + provenance marker',
  ],
  [
    'engine/runtime/analysis/parameterScan.ts',
    (s) => s.includes('parseRuntimeType(tokens, i)'),
    'parameter discovery uses core type resolver',
  ],
];
let success = true;
console.log('FLM core verification. Project root:', root);
for (const [rel, test, label] of checks) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) {
    console.log('MISSING', rel);
    success = false;
    continue;
  }
  const s = fs.readFileSync(f, 'utf8');
  const ok = test(s);
  success &&= ok;
  console.log(
    ok ? 'OK' : 'MISMATCH',
    label,
    '|',
    rel,
    '|',
    crypto.createHash('sha256').update(s).digest('hex').slice(0, 12),
  );
}
const scanDir = (dir, callback, maxFiles = 10000) => {
  if (!fs.existsSync(dir)) return 0;
  const todo = [dir];
  let inspected = 0;
  while (todo.length && inspected < maxFiles) {
    const cur = todo.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (['node_modules', '.git', '.next'].includes(entry.name)) continue;
      const f = path.join(cur, entry.name);
      if (entry.isDirectory()) todo.push(f);
      else if (entry.isFile()) {
        inspected++;
        callback(f);
      }
    }
  }
  return inspected;
};
const copies = [];
scanDir(path.join(root, 'engine'), (f) => {
  if (
    f.endsWith(path.join('runtime', 'helpers', 'typeNames.ts')) ||
    f.endsWith(path.join('runtime', 'interpreter', 'DeclarationEvaluator.ts'))
  )
    copies.push(path.relative(root, f));
});
console.log('Runtime source paths:', copies.length ? copies.join(' | ') : '(none found)');
const outputs = ['dist', 'build', 'out', 'dist-electron', 'release', 'www'];
let jsFiles = 0,
  matched = 0,
  unmatched = 0;
for (const folder of outputs) {
  scanDir(path.join(root, folder), (f) => {
    if (!/\.(js|mjs|cjs)$/.test(f)) return;
    jsFiles++;
    try {
      const size = fs.statSync(f).size;
      if (size > 30_000_000) return;
      const data = fs.readFileSync(f, 'utf8');
      if (data.includes(revision)) {
        matched++;
        console.log('BUNDLE WITH NEW CORE:', path.relative(root, f));
      } else if (data.includes('unsupported declaration tail near')) {
        unmatched++;
        console.log('BUNDLE WITH LEGACY DIAGNOSTIC:', path.relative(root, f));
      }
    } catch {}
  });
}
if (jsFiles === 0)
  console.log('BUNDLE: no JS output in common build directories. Source check cannot prove running bundle.');
else
  console.log(
    'BUNDLE scan:',
    jsFiles,
    'JS files, new core marker:',
    matched,
    'legacy diagnostic without marker:',
    unmatched,
  );
if (unmatched > 0 && matched === 0)
  console.warn(
    'WARNING: detected a compiled JS bundle with old declaration diagnostic; stop/rebuild the app and clear the served bundle cache.',
  );
console.log(
  'NOTE: even a matching bundle on disk cannot prove which web/Electron process is running. Inspect DevTools Sources and rebuild/restart that process.',
);
process.exitCode = success ? 0 : 1;

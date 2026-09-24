// Structural comparison of reference (C++) and actual (TypeScript) JSON.
//
// Numbers compare with a relative tolerance: libm and V8 transcendental
// functions can differ in the last ulp. Strings compare exactly after mapping
// C++ standard-library exception texts, which differ between libc++ (the
// reference harness on macOS) and libstdc++ (the shipped builds), to one
// canonical form.

import { expect } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const LIBRARY_MESSAGES: [RegExp, string][] = [
  [/\b(stod|stof|stold|stoi|stol|stoll|stoul|stoull): (no conversion|out of range)/g, '$1'],
  [/vector::_M_range_check: __n \(which is \d+\) >= this->size\(\) \(which is \d+\)/g, 'vector'],
  [/_Map_base::at|unordered_map::at: key not found|map::at:  key not found|map::at/g, 'map::at'],
  [/array::at: __n \(which is \d+\) >= _Nm \(which is \d+\)/g, 'array::at'],
  [/std::get: wrong index for variant|bad_variant_access|std::bad_variant_access/g, 'bad_variant_access'],
  [/basic_string::(substr|at|erase|insert|replace|compare): __pos \(which is \d+\) > this->size\(\) \(which is \d+\)/g, 'basic_string'],
  [/basic_string::at: __n \(which is \d+\) >= this->size\(\) \(which is \d+\)/g, 'basic_string'],
];

export function normalizeMessage(s: string): string {
  for (const [pattern, replacement] of LIBRARY_MESSAGES) s = s.replace(pattern, replacement);
  return s;
}

export interface CompareOptions {
  /** Relative tolerance for numbers (default 1e-9). */
  tolerance?: number;
  /** Paths matching this get `looseTolerance` (float mesh data by default). */
  loosePaths?: RegExp;
  looseTolerance?: number;
  maxDiffs?: number;
}

export function diffJson(expected: any, actual: any, options: CompareOptions = {}): string[] {
  const tolerance = options.tolerance ?? 1e-9;
  const loosePaths = options.loosePaths ?? /\.(vertices|color)\[/;
  const looseTolerance = options.looseTolerance ?? 2e-5;
  const maxDiffs = options.maxDiffs ?? 25;
  const diffs: string[] = [];
  const show = (v: any) => {
    const s = JSON.stringify(v);
    return s === undefined ? 'undefined' : s.length > 300 ? `${s.slice(0, 300)}…` : s;
  };

  const walk = (e: any, a: any, path: string) => {
    if (diffs.length >= maxDiffs) return;
    if (typeof e === 'number' && typeof a === 'number') {
      const tol = loosePaths.test(path) ? looseTolerance : tolerance;
      if (Math.abs(e - a) > tol * Math.max(1, Math.abs(e), Math.abs(a)))
        diffs.push(`${path}: expected ${e}, got ${a}`);
      return;
    }
    if (typeof e === 'string' && typeof a === 'string') {
      if (normalizeMessage(e) !== normalizeMessage(a)) diffs.push(`${path}: expected ${show(e)}, got ${show(a)}`);
      return;
    }
    if (Array.isArray(e) && Array.isArray(a)) {
      if (e.length !== a.length) {
        diffs.push(`${path}: expected length ${e.length}, got ${a.length}`);
      }
      for (let i = 0; i < Math.min(e.length, a.length); ++i) walk(e[i], a[i], `${path}[${i}]`);
      if (e.length !== a.length && diffs.length < maxDiffs) {
        const extraE = e.slice(a.length, a.length + 2);
        const extraA = a.slice(e.length, e.length + 2);
        if (extraE.length) diffs.push(`${path}: first missing elements ${show(extraE)}`);
        if (extraA.length) diffs.push(`${path}: first unexpected elements ${show(extraA)}`);
      }
      return;
    }
    if (e && a && typeof e === 'object' && typeof a === 'object' && !Array.isArray(e) && !Array.isArray(a)) {
      const keys = new Set([...Object.keys(e), ...Object.keys(a)]);
      for (const key of keys) {
        if (!(key in a)) diffs.push(`${path}.${key}: missing (expected ${show(e[key])})`);
        else if (!(key in e)) diffs.push(`${path}.${key}: unexpected ${show(a[key])}`);
        else walk(e[key], a[key], `${path}.${key}`);
        if (diffs.length >= maxDiffs) return;
      }
      return;
    }
    if (e !== a) diffs.push(`${path}: expected ${show(e)}, got ${show(a)}`);
  };
  walk(expected, actual, '$');
  return diffs;
}

/** Fails the current test with a readable list of differences. */
export function expectSameJson(expected: any, actual: any, options?: CompareOptions) {
  const diffs = diffJson(expected, actual, options);
  expect(diffs, diffs.join('\n')).toEqual([]);
}

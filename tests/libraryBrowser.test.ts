import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { libraries } from '@/features/element-library/config/libraries';
import { ElementLibraryModel } from '@/features/element-library';

it.each(libraries)('covers every $name element with a category, display symbol and local thumbnail', async (asset) => {
  const library = await asset.load();
  const ids = library.elements.map((element) => element.id).sort();
  expect(Object.keys(asset.catalog.items).sort()).toEqual(ids);
  expect([...new Set(asset.catalog.categories.flatMap((category) => category.elements))].sort()).toEqual(ids);
  const icons = new Set<string>();
  for (const { symbol, thumbnail } of Object.values(asset.catalog.items)) {
    expect(symbol).not.toBe('');
    icons.add(thumbnail);
    const svg = readFileSync(`public/library-icons/${asset.name}/${thumbnail}`, 'utf8');
    expect(svg).toContain('viewBox="0 0 160 112"');
    expect(svg).toMatch(/d="M[\d.,L MZ]+"/);
    expect(svg).not.toMatch(/NaN|Infinity|<script|<image|href=/);
    const path = svg.match(/ d="([^"]+)"/)![1];
    const edges = new Set<string>();
    let previous = '',
      start = '';
    for (const [, command, coordinates] of path.matchAll(/([MLZ])([\d.,]*)/g)) {
      const point = command === 'Z' ? start : coordinates;
      const [x, y] = point.split(',').map(Number);
      expect(x, thumbnail).toBeGreaterThanOrEqual(0);
      expect(x, thumbnail).toBeLessThanOrEqual(160);
      expect(y, thumbnail).toBeGreaterThanOrEqual(0);
      expect(y, thumbnail).toBeLessThanOrEqual(112);
      if (command !== 'M') {
        expect(point, `${thumbnail}: zero-length edge`).not.toBe(previous);
        const key = [point, previous].sort().join(';');
        expect(edges.has(key), `${thumbnail}: duplicate edge`).toBe(false);
        edges.add(key);
      } else start = point;
      previous = point;
    }
  }
  // Each icon is fetched separately on demand; variants reuse the same asset.
  expect(
    [...icons].reduce(
      (sum, icon) => sum + gzipSync(readFileSync(`public/library-icons/${asset.name}/${icon}`)).length,
      0,
    ),
  ).toBeLessThan(500 * 1024);
});

it('filters categories and searches the library by XML display symbol, name or C++ entry point', async () => {
  const model = new ElementLibraryModel();
  const asset = libraries.find((asset) => asset.name === 'CGeneral')!;
  model.libraryName = asset.name;
  model.elements = (await asset.load()).elements;
  const cooling = asset.catalog.categories.find((category) => category.name === 'Cooling devices')!;
  expect(model.filteredElements(cooling.id, '').map((element) => element.id)).toEqual(cooling.elements);
  expect(model.filteredElements(cooling.id, '  ACHIL  ').map((element) => element.name)).toEqual([
    'Air cooled chiller',
  ]);
  expect(model.filteredElements(cooling.id, 'makeRTTHR').every((element) => element.entry === 'makeRTTHR')).toBe(true);
  expect(model.filteredElements(cooling.id, 'makeRTTHR').length).toBeGreaterThan(0);
  expect(model.filteredElements('', 'Floor standing fancoil').length).toBeGreaterThan(0);
  expect(model.filteredElements('', 'no such element')).toEqual([]);
  expect(model.filteredElements('', '')).toHaveLength(model.elements.length);
});

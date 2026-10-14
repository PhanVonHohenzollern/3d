import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime';
import { PreviewGeometryEngine } from '@engine/geometry';
import { FunctionWorkspace } from '@/entities/source-function';
import { libraries } from '@/features/element-library/config/libraries';
import { decodeLibraryAsset, prepareElementSource } from '@/features/element-library/model/sourceLibrary';
import { visibleSurfaceThumbnail } from '@tests/support/thumbnail';

function box(size: number) {
  return {
    vertices: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ].map(([x, y, z]) => ({ x: x * size, y: y * size, z: z * size, nx: 0, ny: 0, nz: 0 })),
    indices: [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
    ],
  };
}

it('shows only the nine visible box edges and no triangulation or back edges', () => {
  const svg = visibleSurfaceThumbnail([box(2)]);
  expect(svg.match(/M/g)).toHaveLength(9);
});

it('does not show a component fully enclosed behind the outer surface', () => {
  expect(visibleSurfaceThumbnail([box(2), box(1)])).toBe(visibleSurfaceThumbnail([box(2)]));
});

it('clips only the hidden middle of an edge and keeps both visible ends', () => {
  const line = {
    primitive: 'lines' as const,
    vertices: [
      [-5, 5, -1],
      [5, -5, -1],
    ].map(([x, y, z]) => ({ x, y, z, nx: 0, ny: 0, nz: 0 })),
    indices: [0, 1],
  };
  const svg = visibleSurfaceThumbnail([box(2), line]);
  const horizontal = [...svg.matchAll(/M([\d.]+),([\d.]+)L([\d.]+),([\d.]+)/g)]
    .map((match) => match.slice(1).map(Number))
    .filter(([, y1, , y2]) => Math.abs(y1 - y2) < 0.01);
  expect(horizontal).toHaveLength(2);
  expect(horizontal[0][0]).toBe(8);
  expect(horizontal[0][2]).toBeLessThan(80);
  expect(horizontal[1][0]).toBeGreaterThan(80);
  expect(horizontal[1][2]).toBe(152);
});

// These source thumbnails contained hidden edges. Keep their exported outlines
// tied to the actual geometry; regenerate explicitly after geometry changes.
it.each([
  ['GRUNDFOS', 'mixit.svg'],
  ['CGeneral', 'nc_18_3.svg'],
  ['CGeneral', 'crswld_3.svg'],
])('exports visible exterior edges for %s/%s', async (libraryName, thumbnail) => {
  const asset = libraries.find((item) => item.name === libraryName)!;
  const id = Object.keys(asset.catalog.items).find((id) => asset.catalog.items[id].thumbnail === thumbnail)!;
  const element = (await asset.load()).elements.find((item) => item.id === id)!;
  const workspace = new FunctionWorkspace();
  workspace.replaceFiles(
    prepareElementSource(
      asset.sources.map((source) => ({
        name: source.name,
        code: decodeLibraryAsset(readFileSync(`public/${source.path}`)),
      })),
      element.entry,
    ),
  );
  const program = workspace.program();
  const runtime = new GeometryRuntime();
  runtime.setParameters(element.resolve!().values);
  const result = runtime.executeUpToLine(program.source, 100000, true, program.options);
  expect(result.diagnostics).toEqual([]);
  const scene = new PreviewGeometryEngine().build(result);
  expect(scene.warnings).toEqual([]);
  const svg = visibleSurfaceThumbnail(scene.meshes);
  const path = `public/library-icons/${libraryName}/${thumbnail}`;
  if (process.env.npm_lifecycle_event === 'update-library-icons') writeFileSync(path, svg);
  expect(readFileSync(path, 'utf8')).toBe(svg);
});

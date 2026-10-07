import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { GeometryRuntime } from '@engine/runtime';
import { prepareElementSource, ElementLibraryModel } from '@/features/element-library';
import { decodeLibraryAsset } from '@/features/element-library/model/sourceLibrary';
import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import type { ElementLibrary, LibraryElement } from '@/features/element-library/model/types';
import { FunctionWorkspace } from '@/entities/source-function';
import { sourceFunctions } from '@/entities/source-function';
import { buildConnectorPreview, PreviewGeometryEngine } from '@engine/geometry';
import { ParameterPanelModel } from '@/features/edit-parameters';

function catalog(name: string): ElementLibrary {
  return JSON.parse(readFileSync(`public/demo/presets/${name}.json`, 'utf8'));
}

function preset(element: LibraryElement, selection: Record<string, string> = {}) {
  const variant = element.variants.find((item) =>
    Object.entries(selection).every(([name, value]) => item.selection[name] === value),
  );
  if (!variant) throw new Error('No matching preset');

  return {
    values: new Map(Object.entries({ ...element.defaults, ...variant.selection, ...variant.defaults })),
    connectors: variant.connectors ?? element.connectors,
  };
}

function load(library: string, stem: string, symbol: string, selection: Record<string, string> = {}) {
  const element = catalog(library).elements.find((item) => item.symbol === symbol)!;
  const sample = preset(element, selection);
  const sources = ['h', 'cpp'].map((extension) => ({
    name: `${stem}.${extension}`,
    code: decodeLibraryAsset(readFileSync(`public/demo/code/${library}/${stem}.${extension}`)),
  }));
  const workspace = new FunctionWorkspace();
  workspace.replaceFiles(prepareElementSource(sources, element.entry));
  const program = workspace.program();
  const runtime = new GeometryRuntime();
  const parameters = runtime.discoverParameters(program.source, program.options);
  const panel = new ParameterPanelModel();
  panel.loadValues(parameters, sample.values);
  runtime.setParameters(panel.overrides());
  const result = runtime.executeUpToLine(program.source, program.source.split('\n').length, true, program.options);
  expect(
    result.diagnostics,
    workspace.fileNames
      .filter((name) => name.endsWith('.h'))
      .map((name) => workspace.source(name))
      .join('\n'),
  ).toEqual([]);
  const scene = new PreviewGeometryEngine().build(result);
  expect(scene.meshes.length).toBeGreaterThan(0);
  for (const mesh of scene.meshes)
    expect(mesh.vertices.every((point) => [point.x, point.y, point.z].every(Number.isFinite))).toBe(true);
  const connectors = sample.connectors.map((connector) =>
    buildConnectorPreview(connector, (expression) => evaluateLibraryExpression(expression, sample.values)),
  );

  return { values: sample.values, connectors, scene };
}

describe('prepared example library', () => {
  it('opens Main with only the element and links helper declarations, defaults and implementations', () => {
    const files = prepareElementSource(
      [
        {
          name: 'Example.h',
          code: `class Example {
        public:
          short makePart();
          double twice(double value = 3);
          double increment(double value) { return value + 1; }
          void unused();
      };`,
        },
        {
          name: 'Example.cpp',
          code: `#define FACTOR 2
        const double shift = 4;
        short Example::makePart() {
          double diameter = twice() + shift;
          makeSimpleTube(FdPoint3d(0,0,0), FdPoint3d(0,0,10), diameter, diameter, 8);
          return 0;
        }
        double Example::twice(double value) { return increment(value) * FACTOR; }
        void Example::unused() { unknownFunction(); }`,
        },
      ],
      'makePart',
    );
    const main = files.find((file) => file.name === '')!.code;
    const header = files.find((file) => file.name === 'Example.h')!.code;
    const source = files.find((file) => file.name === 'Example.cpp')!.code;
    expect(sourceFunctions(main).map((fn) => fn.name)).toEqual(['makePart']);
    expect(header).toContain('Example::twice(double value = 3)');
    expect(header).toContain('Example::increment(double value);');
    expect(header).not.toContain('return value');
    expect(
      sourceFunctions(source)
        .map((fn) => fn.name)
        .sort(),
    ).toEqual(['increment', 'twice']);
    expect(files.every((file) => !file.code.includes('unused'))).toBe(true);
    const workspace = new FunctionWorkspace();
    workspace.replaceFiles(files);
    expect(workspace.activeFile).toBe('');
    const program = workspace.program();
    const result = new GeometryRuntime().executeUpToLine(
      program.source,
      program.source.split('\n').length,
      true,
      program.options,
    );
    expect(result.diagnostics).toEqual([]);
    expect(new PreviewGeometryEngine().build(result).meshes.length).toBeGreaterThan(0);
  });

  it('creates the matching helper header when the supplied code has only a CPP file', () => {
    const files = prepareElementSource(
      [
        {
          name: 'Sample.cpp',
          code: `
      short main() { helper(); return 0; }
      void helper() { makeSimpleTube(FdPoint3d(0,0,0), FdPoint3d(0,0,10), 2, 2, 8); }
    `,
        },
      ],
      'main',
    );
    expect(files.map((file) => file.name)).toEqual(['', 'Sample.h', 'Sample.cpp']);
    expect(files[1].code).toBe('void helper();');
    expect(sourceFunctions(files[2].code).map((fn) => fn.name)).toEqual(['helper']);
  });

  it.each([
    ['CGeneral', 'CGeneral', 'BUTTV'],
    ['GRUNDFOS', 'GRUNDFOS', 'magnaMAGNA3'],
    ['GRUNDFOS', 'GRUNDFOS', 'MIXIT'],
    ['BELIMO', 'CBELIMO', 'BELIMO_EV_F'],
    ['BELIMO', 'CBELIMO', 'BELIMO_D6_N'],
  ])('builds %s / %s / %s from prepared defaults', (library, stem, symbol) => {
    const loaded = load(library, stem, symbol);
    expect(loaded.connectors.length).toBeGreaterThan(0);
    expect(loaded.scene.warnings).toEqual([]);
  });

  it('keeps the verified BUTTV dimensions and connectors', () => {
    const { values, connectors } = load('CGeneral', 'CGeneral', 'BUTTV', {
      DN: '32',
      conn: 'centering lugs',
      act: 'hand lever',
    });
    expect(Object.fromEntries(values)).toMatchObject({
      DN: '32',
      L1: '112',
      H1: '130',
      H2: '57',
      E: '32',
      act: 'hand lever',
    });
    expect(connectors.map((connector) => connector.point.y)).toEqual([-16, 16]);
    expect(connectors.map((connector) => connector.direction.y)).toEqual([-1, 1]);
  });

  it('provides the alternate connection and actuator preset', () => {
    const { values } = load('CGeneral', 'CGeneral', 'BUTTV', { DN: '80', conn: 'tapped lugs', act: 'gear box' });
    expect(Object.fromEntries(values)).toMatchObject({ E: '46', L1: '179', H2: '89', act: 'gear box' });
  });

  it('uses the prepared flanged MAGNA3 variant', () => {
    load('GRUNDFOS', 'GRUNDFOS', 'magnaMAGNA3', { conn_type: 'DIN' });
  });

  it('selects the MIXIT connector side with its preset', () => {
    const element = catalog('GRUNDFOS').elements.find((item) => item.symbol === 'MIXIT')!;

    const position = (side: string) => {
      const sample = preset(element, { bport: side });

      return sample.connectors.map(
        (connector) =>
          buildConnectorPreview(connector, (expression) => evaluateLibraryExpression(expression, sample.values)).point
            .y,
      );
    };

    expect(position('Left')).toEqual([0, 0, -125]);
    expect(position('Right')).toEqual([0, 0, 125]);
  });

  it('contains ready values, not XML documents or table rules', () => {
    expect(readdirSync('public/demo').sort()).toEqual(['code', 'presets']);
    for (const name of ['CGeneral', 'GRUNDFOS', 'BELIMO']) {
      const library = catalog(name);
      expect(new Set(library.elements.map((element) => element.id)).size).toBe(library.elements.length);
      for (const element of library.elements) {
        expect(element).not.toHaveProperty('rules');
        if (element.error) {
          expect(element.variants).toHaveLength(0);
          continue;
        }
        expect(element.entry).not.toBe('');
        expect(element.variants.length).toBeGreaterThan(0);
        expect(new Set(element.variants.map((variant) => JSON.stringify(variant.selection))).size).toBe(
          element.variants.length,
        );
        for (const variant of element.variants)
          expect(Object.values(variant.defaults).every((value) => typeof value === 'string')).toBe(true);
      }
    }
  });

  it('evaluates editable connector expressions and rejects empty or missing values', () => {
    const values = new Map([
      ['alfa', '90'],
      ['d', '20'],
    ]);
    expect(evaluateLibraryExpression('d*sin(alfa)+2^3', values)).toBeCloseTo(28);
    expect(evaluateLibraryExpression('max(1,d/2)', values)).toBe(10);
    expect(evaluateLibraryExpression('-2^2+1e-3', values)).toBeCloseTo(-3.999);
    expect(() => evaluateLibraryExpression('missing+1', values)).toThrow('Missing');
    expect(() => evaluateLibraryExpression('1/0', values)).toThrow('Invalid');
    expect(() => evaluateLibraryExpression('d+1', new Map([['d', ' ']]))).toThrow('invalid');
  });

  it('opens and changes presets without fetching or parsing XML', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      expect(path).not.toMatch(/\.xml(?:$|\?)/);
      const body = readFileSync('public/' + path.replace(/^\//, ''));

      return {
        ok: true,
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      } as Response;
    });
    const parser = vi.fn(() => {
      throw new Error('XML must not be parsed');
    });
    vi.stubGlobal('DOMParser', parser);
    try {
      const model = new ElementLibraryModel();
      const opened: { values: ReadonlyMap<string, string>; replace: boolean }[] = [];
      model.openRequested.connect((sample, replace) => opened.push({ values: sample.values, replace }));
      await model.selectLibrary('CGeneral');
      model.openElement(model.elements.find((element) => element.symbol === 'BUTTV')!.id);
      expect(model.canOpen).toBe(true);
      expect(opened).toHaveLength(1);
      expect(opened[0].replace).toBe(true);
      const initial = [...model.resolution.values];
      model.selectValue('DN', '80');
      expect(opened.at(-1)?.replace).toBe(false);
      expect(opened.at(-1)?.values.get('L1')).toBe('137');
      model.reset();
      expect([...opened.at(-1)!.values]).toEqual(initial);
      model.selectValue('DN', '9999');
      expect(model.canOpen).toBe(false);
      expect(model.resolution.errors).toEqual(['No preset for this size/variant.']);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(parser).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

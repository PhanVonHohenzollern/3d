import { expect, it } from 'vitest';
import CGeneral from '@/features/element-library/data/CGeneral';
import { libraries } from '@/features/element-library/config/libraries';
import { readFileSync } from 'node:fs';
import { decodeLibraryAsset, prepareElementSource } from '@/features/element-library/model/sourceLibrary';
import { FunctionWorkspace } from '@/entities/source-function';
import { GeometryRuntime } from '@engine/runtime';
import { PreviewGeometryEngine, buildConnectorPreview } from '@engine/geometry';
import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import { ParameterPanelModel } from '@/features/edit-parameters';
import { defineLibrary } from '@/features/element-library/model/valueTables';
import { resolveXml, type XmlElement } from '@/features/element-library/model/xmlRules';

it.each(libraries)(
  'resolves $name current rows, geometry and conditional connectors without variants',
  async (asset) => {
    const library = await asset.load();
    const sources = asset.sources.map((source) => ({
      name: source.name,
      code: decodeLibraryAsset(readFileSync(`public/${source.path}`)),
    }));
    const failures: string[] = [];
    const programs = new Map<string, ReturnType<FunctionWorkspace['program']>>();
    for (const element of library.elements) {
      if (element.error) continue;
      const resolved = element.resolve!();
      let program = programs.get(element.entry);
      if (!program) {
        const workspace = new FunctionWorkspace();
        workspace.replaceFiles(prepareElementSource(sources, element.entry));
        program = workspace.program();
        programs.set(element.entry, program);
      }
      const runtime = new GeometryRuntime();
      const panel = new ParameterPanelModel();
      panel.loadValues(runtime.discoverParameters(program.source, program.options), resolved.values);
      runtime.setParameters(panel.overrides());
      const result = runtime.executeUpToLine(program.source, 100000, true, program.options);
      const scene = new PreviewGeometryEngine().build(result);
      if (result.diagnostics.length || scene.warnings.length)
        failures.push(
          `${element.id} ${element.entry}: ${JSON.stringify([result.diagnostics, scene.warnings, Object.fromEntries(resolved.values)])}`,
        );
      panel.updateRuntimeResult(result);
      const context = new Map([...resolved.values, ...panel.contextValues()]);
      for (const link of resolved.connectors) {
        if (link.connectionType?.startsWith('%') || link.technology?.startsWith('%'))
          failures.push(`${element.id} unresolved ${link.connectionType} / ${link.technology}`);
        try {
          buildConnectorPreview(link, (expression) => evaluateLibraryExpression(expression, context));
        } catch (error) {
          failures.push(`${element.id} ${link.name}: ${error}`);
        }
      }
    }
    expect(failures).toEqual([]);
  },
  60000,
);

it('updates table dimensions and keeps an out-of-table manual input', () => {
  const element = CGeneral.elements.find((e) => e.entry === 'make2WayValve' && e.defaults.elType === '7')!;
  const initial = element.resolve!();
  const values = new Map(initial.values).set('diam', '65');
  const next = element.resolve!(values, ['diam']);
  expect(next.values.get('diam')).toBe('65');
  expect(next.values.get('l')).toBe('180');
  expect(next.options.get('diam')).toContain('65');
  values.set('diam', '63.5');
  expect(element.resolve!(values, ['diam']).values.get('diam')).toBe('63.5');
});

it('selects the CHIL connector pair through the reverse function table', () => {
  const element = CGeneral.elements.find((e) => e.name === 'Floor standing fancoil')!;
  let current = element.resolve!();
  for (const [ftype, func, names] of [
    ['1', '1', ['C2', 'H2']],
    ['2', '2', ['C3', 'H3']],
    ['0', '0', ['C1', 'H1']],
  ] as const) {
    current = element.resolve!(new Map(current.values).set('ftype', ftype), ['ftype']);
    expect(current.values.get('func_idx')).toBe(func);
    expect(current.connectors.map((link) => link.name)).toEqual(names);
  }
});

it('resolves independent lists without expanding their billion combinations', () => {
  const library = defineLibrary('test', [
    {
      id: 'large',
      name: 'Large',
      entry: 'makeLarge',
      symbol: 'Large',
      defaults: {},
      connectors: [],
      selectors: [],
      tables: ['A', 'B', 'H'].map((name) => ({
        columns: [name],
        rows: Array.from({ length: 1000 }, (_, n) => [String(n + 1)]),
      })),
    },
  ]);
  const element = library.elements[0];
  Object.defineProperty(element, 'variants', {
    get() {
      throw new Error('Must not expand variants');
    },
  });
  expect(
    Object.fromEntries(
      element.resolve!(
        new Map([
          ['A', '10'],
          ['B', '20'],
        ]),
        ['A', 'B'],
      ).values,
    ),
  ).toEqual({ A: '10', B: '20', H: '1' });
  expect(element.resolve!().options.get('H')).toHaveLength(1000);
});

it('lists only available XML-backed geometry examples', () => {
  expect(CGeneral.elements).toHaveLength(180);
  expect(CGeneral.elements.filter((element) => element.error || !element.entry)).toEqual([]);
  expect(
    CGeneral.elements.find((element) => element.id === '1BEF141F-D8DB-4FB0-9598-9B2352B8ADAC')!.resolve!().values.get(
      'B',
    ),
  ).toBe('300');
});

it('keeps manual sizes outside a table and propagates formulas without changing independent edits', () => {
  const element: XmlElement = {
    entry: 'makeExample',
    links: [],
    rules: [
      {
        table: 'sizes',
        columns: [
          [0, 'diam', 8],
          [1, 'wall', 2],
        ],
      },
      { limits: [['radius', 0, 'diam/2', true]] },
    ],
  };
  const tables = {
    sizes: [
      ['10', '20'],
      ['1', '2'],
    ],
  };
  const next = resolveXml(
    { tables, elements: { example: element } },
    element,
    new Map([
      ['diam', '17.5'],
      ['wall', '1'],
      ['radius', '5'],
      ['height', '777'],
    ]),
    ['diam'],
  );
  expect(Object.fromEntries(next)).toEqual({ diam: '17.5', wall: '1', radius: '8.75', height: '777' });
});

it('can select an XML output dimension to update its input size and the remaining dimensions', () => {
  const element = CGeneral.elements.find((e) => e.id === '148551FC-803C-4066-9BC4-6FFE783916C4')!;
  const initial = element.resolve!();
  expect(initial.options.get('SW')).toContain('44');
  const result = element.resolve!(new Map(initial.values).set('SW', '44'), ['SW']);
  expect(result.values.get('SW')).toBe('44');
  expect(result.values.get('d1')).toBe('25');
  expect(result.values.get('C')).toBe('20');
});

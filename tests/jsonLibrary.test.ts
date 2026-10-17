import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  readParsedLibrary,
  isHiddenVariable,
  SpecificationIndex,
  type FlmEntity,
  type FlmRestriction,
  type ParsedLibraryJSON,
} from '@/features/element-library/model/parsedLibrary';
import { CompiledConstraintGraph, UnifiedConstraintSolver } from '@/features/element-library/model/constraintGraph';
import { createJsonLibrary } from '@/features/element-library/model/jsonLibrary';
import { libraries } from '@/features/element-library/config/libraries';
import { CGeneral } from '@tests/libraryData';
import { createWorkspace } from '@tests/pages/workspace/harness';
import { build } from 'vite';
// eslint-disable-next-line no-restricted-imports
import { discoverLibraries, geometryRegistry, flmLibraries } from '../scripts/flmLibraries';

function definition(): ParsedLibraryJSON {
  return {
    schemaVersion: '2.1-columnar-en',
    library: {},
    entities: {},
    specifications: {},
    technologies: {},
    folders: [],
  };
}

function element(names: string[]): FlmEntity {
  return {
    id: 'example',
    guid: 'entity',
    variables: names.map((id) => ({ id, valueTypeCode: 2, defaultValues: [], options: [], properties: {} })),
    restrictions: [],
    connectors: [],
  };
}

function tableRule(library: ParsedLibraryJSON, entity: FlmEntity, columns: string[], rows: number[][]): FlmRestriction {
  const guid = 'table' + Object.keys(library.specifications).length;
  library.specifications[guid] = {
    guid,
    id: guid,
    columns,
    arrayAttributes: { COLS: rows.length },
    dataColumns: columns.map((_, col) => [['plain', rows.map((r) => r[col])], { typeCode: 2 }]),
  };
  const rule = {
    index: entity.restrictions.length,
    typeCode: 1,
    tableGuid: guid,
    conditionsRaw: {},
    bindings: columns.map((variable, columnKey) => ({ variable, columnKey, levelCode: 0, bindingTypeCode: 1 })),
    extraFields: [],
  };
  entity.restrictions.push(rule);

  return rule;
}

describe('packed JSON', () => {
  it('accepts absent optional components and preserves metadata without mutating the document', () => {
    const input = {
      schemaVersion: '2.1-columnar-en',
      library: {},
      entities: { e: { id: 'e', guid: 'e', variables: [], vendorMetadata: 27 } },
    };
    const parsed = readParsedLibrary(input);
    expect(parsed.entities.e.restrictions).toEqual([]);
    expect(parsed.entities.e).toHaveProperty('vendorMetadata', 27);
    expect(parsed.technologies).toEqual({});
    expect(input.entities.e).not.toHaveProperty('restrictions');
    expect(new UnifiedConstraintSolver(new CompiledConstraintGraph(parsed, parsed.entities.e)).solve().status).toBe(
      'valid',
    );
  });
  it('reads the supplied file, preserving row correlation and resolving shared tables by GUID', () => {
    const source = readFileSync('libraries/CGeneral/CGeneral.json');
    expect(source.byteLength).toBe(1432020);
    const library = readParsedLibrary(JSON.parse(source.toString()));
    expect(Object.keys(library.entities)).toHaveLength(184);
    expect(Object.keys(library.specifications)).toHaveLength(267);
    for (const table of Object.values(library.specifications))
      expect(new SpecificationIndex(table).rows.length).toBe(table.arrayAttributes.COLS);
  });
  it('keeps visibility metadata for every bundled CGeneral element consistent with the supplied JSON', () => {
    const parsed = readParsedLibrary(JSON.parse(readFileSync('libraries/CGeneral/CGeneral.json', 'utf8')));
    const byGuid = new Map(Object.values(parsed.entities).map((entity) => [entity.guid, entity]));
    for (const item of CGeneral.elements) {
      const guid = item.id;
      const entity = byGuid.get(guid)!;
      expect(entity, guid).toBeDefined();
      expect(item.hiddenParameters ?? [], entity.id).toEqual(
        entity.variables.filter(isHiddenVariable).map((v) => v.id),
      );
    }
  });
  it('honors explicit visibility and preserves unknown type codes', () => {
    const json = definition(),
      entity = element(['hidden', 'legacyHidden', 'visible', 'unknown']);
    json.entities.example = entity;
    entity.variables[0].visible = false;
    entity.variables[1].variableTypeCode = 7;
    entity.variables[2].variableTypeCode = 7;
    entity.variables[2].visible = true;
    entity.variables[3].variableTypeCode = 987;
    const library = createJsonLibrary('Visibility', json, { entity: { entry: 'makeTest' } });
    expect(library.elements[0].hiddenParameters).toEqual(['hidden', 'legacyHidden']);
    expect(library.elements[0].selectors.map((s) => s.name)).toEqual(['visible', 'unknown']);
    expect(entity.variables[3].variableTypeCode).toBe(987);
  });
  it('rejects unsupported formats and corrupt dictionary references', () => {
    expect(() => readParsedLibrary({ format: 'FLM-PACK-1', schemaVersion: '99' })).toThrow(/Unsupported/);
    expect(() =>
      readParsedLibrary({
        format: 'FLM-PACK-1',
        schemaVersion: '2.0',
        strings: [],
        recordLayouts: [],
        library: ['$', 10],
      }),
    ).toThrow(/reference/);
  });
  it('distinguishes empty cells, missing cells and missing English', () => {
    const index = new SpecificationIndex({
      guid: 't',
      id: 't',
      columns: ['x'],
      arrayAttributes: { COLS: 3 },
      dataColumns: [[['dict', ['', null, { _enAbsent: true }], [0, 1, 2]], { typeCode: 6 }]],
    });
    expect(index.columns[0]).toEqual(['', undefined, undefined]);
    expect([...index.matching(0, '')]).toEqual([0]);
  });
});

describe('dependency graph and snapshots', () => {
  it('never commits a limit-clamped value outside the active table relation', () => {
    const library = definition(),
      entity = element(['d']);
    tableRule(library, entity, ['d'], [[10], [20]]);
    entity.variables[0].defaultValues = [10];
    entity.variables[0].properties.MIN_VALUE = 15;
    const solver = new UnifiedConstraintSolver(new CompiledConstraintGraph(library, entity));
    expect(solver.solve().resolvedValues.get('d')).toBe('20');
    entity.restrictions.push({
      index: 1,
      typeCode: 2,
      conditionsRaw: {},
      bindings: [],
      extraFields: [
        {
          tag: 'LIMIT',
          text: null,
          children: [],
          attributes: { NAME: 'd', TYPE: '1', RELATION: '2', EXPRESSION: '5' },
        },
      ],
    });
    const impossible = new UnifiedConstraintSolver(new CompiledConstraintGraph(library, entity)).solve();
    expect(impossible.status).toBe('conflict');
  });
  it('solves coupled diameter rows before dependent dimensions and supports reverse edits', () => {
    const library = definition(),
      entity = element(['d1', 'd2', 'd3', 'l1']);
    tableRule(
      library,
      entity,
      ['d1', 'd2', 'd3'],
      [
        [20, 20, 15],
        [25, 25, 15],
        [25, 25, 20],
      ],
    );
    const blue = tableRule(
      library,
      entity,
      ['d1', 'l1'],
      [
        [20, 32],
        [25, 40],
      ],
    );
    blue.bindings[1].bindingTypeCode = 2;
    const graph = new CompiledConstraintGraph(library, entity),
      solver = new UnifiedConstraintSolver(graph);
    expect(graph.groups.some((g) => ['d1', 'd2', 'd3'].every((v) => g.variables.includes(v)))).toBe(true);
    const initial = solver.solve();
    const forward = solver.solve(new Map([...initial.resolvedValues, ['d1', '25']]), ['d1']);
    expect(forward.status).toBe('valid');
    expect(Object.fromEntries(forward.resolvedValues)).toMatchObject({ d1: '25', d2: '25', l1: '40' });
    const reverse = solver.solve(new Map([...forward.resolvedValues, ['l1', '32']]), ['l1']);
    expect(reverse.status).toBe('valid');
    expect(reverse.resolvedValues.get('d1')).toBe('20');
    const invalid = solver.solve(
      new Map([
        ['d1', '20'],
        ['d2', '25'],
      ]),
      ['d1', 'd2'],
    );
    expect(invalid.status).toBe('conflict');
  });
  it('finds a jointly impossible cycle even when every table has local support', () => {
    const library = definition(),
      entity = element(['a', 'b', 'c']);
    tableRule(
      library,
      entity,
      ['a', 'b'],
      [
        [0, 0],
        [1, 1],
      ],
    );
    tableRule(
      library,
      entity,
      ['b', 'c'],
      [
        [0, 0],
        [1, 1],
      ],
    );
    tableRule(
      library,
      entity,
      ['a', 'c'],
      [
        [0, 1],
        [1, 0],
      ],
    );
    expect(new UnifiedConstraintSolver(new CompiledConstraintGraph(library, entity)).solve().status).toBe('conflict');
  });
  it('avoids a Cartesian product for independent groups and invalidates cached edits', () => {
    const library = definition(),
      entity = element(Array.from({ length: 24 }, (_, i) => 'd' + i));
    for (const v of entity.variables) tableRule(library, entity, [v.id], [[10], [20]]);
    const solver = new UnifiedConstraintSolver(new CompiledConstraintGraph(library, entity));
    const initial = solver.solve();
    expect(initial.status).toBe('valid');
    const edited = solver.solve(new Map([...initial.resolvedValues, ['d0', '20']]), ['d0']);
    expect(edited.status).toBe('valid');
    expect(edited.affectedGroups.length).toBeLessThan(24);
    expect(edited.resolvedValues.get('d0')).toBe('20');
    expect(edited.validOptions.get('d0')).toEqual(['10', '20']);
    expect(solver.solve(new Map([...edited.resolvedValues, ['d0', '30']]), ['d0']).status).toBe('conflict');
  });
  it('does not block inactive missing tables and detects invalid numeric edits', () => {
    const library = definition(),
      entity = element(['flag', 'x']);
    entity.variables[0].defaultValues = [0];
    entity.variables[1].defaultValues = [2];
    entity.variables[1].valueTypeCode = 1;
    entity.restrictions.push({
      index: 0,
      typeCode: 1,
      tableGuid: 'missing',
      conditionsRaw: { CND_VAR1: 'flag', CND_REL1: 3, CND_VAL1: '1' },
      bindings: [],
      extraFields: [],
    });
    const solver = new UnifiedConstraintSolver(new CompiledConstraintGraph(library, entity));
    expect(solver.solve().status).toBe('valid');
    expect(solver.solve(new Map([['flag', '1']]), ['flag']).status).toBe('unresolved');
    expect(solver.solve(new Map([['x', 'bad']]), ['x']).status).toBe('conflict');
    expect(solver.solve(new Map([['x', '2.5']]), ['x']).status).toBe('valid');
  });
  it('recomputes expression defaults using degrees and keeps maximum limits as bounds', () => {
    const library = definition(),
      entity = element(['d', 'length']);
    entity.variables[0].defaultValues = [10];
    entity.restrictions.push({
      index: 0,
      typeCode: 2,
      conditionsRaw: {},
      bindings: [],
      extraFields: [
        {
          tag: 'LIMIT',
          text: null,
          children: [],
          attributes: { NAME: 'length', TYPE: '1', RELATION: '3', EXPRESSION: 'd*sin(90)' },
        },
        {
          tag: 'LIMIT',
          text: null,
          children: [],
          attributes: { NAME: 'length', TYPE: '1', RELATION: '2', EXPRESSION: '2*d' },
        },
      ],
    });
    const solver = new UnifiedConstraintSolver(new CompiledConstraintGraph(library, entity));
    const initial = solver.solve();
    expect(initial.resolvedValues.get('length')).toBe('10');
    const next = solver.solve(new Map([...initial.resolvedValues, ['d', '25']]), ['d']);
    expect(next.resolvedValues.get('length')).toBe('25');
    expect(next.status).toBe('valid');
  });
});

describe('automatic example registration', () => {
  it('pairs the actual C++ registry without guessing make + XML symbol', () => {
    expect([
      ...geometryRegistry('const char* __GEO_NAME[]={"Block"}; const auto __GEO_FN[]={&Creator::makeDifferent};'),
    ]).toEqual([['Block', 'makeDifferent']]);
    expect(() => geometryRegistry('const char* __GEO_NAME[]={"A","B"}; const auto __GEO_FN[]={&C::makeA};')).toThrow(
      /differ/,
    );
  });
  it('discovers and builds a new library from JSON, header and implementation alone, with no SVG', async () => {
    const root = mkdtempSync(join(tmpdir(), 'flm-json-'));
    try {
      const path = join(root, 'libraries/NewLibrary');
      mkdirSync(path, { recursive: true });
      const library = definition(),
        entity = element(['d']);
      library.entities.example = entity;
      entity.geometry = {
        tag: 'DEF_GEOMETRY',
        attributes: { TYPE: '1' },
        text: null,
        children: [{ tag: 'FNBLKNAME', text: 'Block', attributes: {}, children: [] }],
      };
      entity.variables[0].defaultValues = [15];
      writeFileSync(join(path, 'library.json'), JSON.stringify(library));
      writeFileSync(
        join(path, 'custom.h'),
        'const char* __GEO_NAME[]={"Block"}; const auto __GEO_FN[]={&C::makeTest};',
      );
      writeFileSync(join(path, 'custom.cpp'), 'short C::makeTest(){ return 0; }');
      const [{ descriptor }] = discoverLibraries(root);
      expect(descriptor.entries.entity).toEqual({ entry: 'makeTest' });
      expect(descriptor.catalog.items.entity.thumbnail).toBe('');
      expect(descriptor.sources).toHaveLength(2);
      expect(createJsonLibrary('NewLibrary', library, descriptor.entries).elements[0].resolve!().values.get('d')).toBe(
        '15',
      );
      entity.paths = [{ NAME: 'ENT_SMALLSLIDE', value: 'AnySlide.SLB' }];
      writeFileSync(join(path, 'library.json'), JSON.stringify(library));
      mkdirSync(join(path, 'icons'));
      writeFileSync(join(path, 'icons/AnySlide.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 0L16 16"/></svg>');
      expect(discoverLibraries(root)[0].descriptor.catalog.items.entity.thumbnail).toBe('AnySlide.svg');
      writeFileSync(join(root, 'main.js'), 'export {default} from "virtual:flm-libraries";');
      const result = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [flmLibraries(root)],
        build: { write: false, lib: { entry: join(root, 'main.js'), formats: ['es'] } },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
        'output' in output ? output.output : [],
      );
      expect(outputs.some((output) => output.fileName === 'demo/libraries/NewLibrary/custom.cpp')).toBe(true);
      expect(outputs.some((output) => output.fileName === 'library-icons/NewLibrary/AnySlide.svg')).toBe(true);
      expect(outputs.some((output) => output.type === 'chunk' && output.code.includes('makeTest'))).toBe(true);
      expect(
        outputs.some((output) => output.type === 'chunk' && !output.isEntry && output.code.includes('2.1-columnar-en')),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

it('keeps new JSON Parameters, geometry and connectors on one valid snapshot after edits', async () => {
  const json = definition(),
    entity = element(['d', 'l', 'internal']);
  entity.variables[2].visible = false;
  json.entities.example = entity;
  tableRule(
    json,
    entity,
    ['d', 'l', 'internal'],
    [
      [10, 30, 4],
      [20, 60, 8],
    ],
  ).bindings[1].bindingTypeCode = 2;
  entity.connectors = [
    {
      id: 'Outlet',
      attributes: { TYPE: 12 },
      conditionsRaw: {},
      fields: { DIR: 1 },
      diameterExpression: 'd',
      positionExpressions: { X: 'l', Y: '0', Z: '0' },
    },
  ];
  const library = createJsonLibrary('NewLibrary', json, { entity: { entry: 'makeTest' } });
  const source =
    'short C::makeTest(){ double d=0, l=0, internal=0; get_val("d",d); get_val("l",l); get_val("internal",internal); makeFlatDisc(FdPoint3d(l,0,0), vx, internal, 32); return 0; }';
  const asset = {
    name: 'NewLibrary',
    catalog: { label: 'NewLibrary', categories: [], items: {} },
    sources: [{ name: 'custom.cpp', path: 'demo/custom.cpp' }],
    load: async () => library,
  };
  libraries.push(asset);
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode(source).buffer } as Response);
  const { mw, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('NewLibrary');
    mw.library.openElement('entity');
    expect(mw.library.error).toBe('');
    expect(mw.library.canOpen).toBe(true);

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3)).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    const check = (d: string, l: string) => {
      expect(parameters.rows.some((row) => row.texts[0] === 'internal')).toBe(false);
      expect(parameters.contextValues().get('internal')).toBe(String(Number(d) * 0.4));
      expect(Number(mw.session.lastResult.parameterRequests.find((p) => p.name === 'internal')?.currentValue)).toBe(
        Number(d) * 0.4,
      );
      expect(parameters.contextValues().get('d')).toBe(d);
      expect(parameters.contextValues().get('l')).toBe(l);
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.meshes.length).toBeGreaterThan(0);
      expect(mw.session.scene.meshes[0].vertices.every((p) => p.x === Number(l))).toBe(true);
      expect(links.definitions()[0].position[0]).toBe('l');
    };

    check('10', '30');
    edit('d', '20');
    check('20', '60');
    const scene = mw.session.scene;
    edit('d', '999');
    check('20', '60');
    expect(mw.session.scene).toBe(scene);
    edit('l', '30');
    check('10', '30');
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    libraries.splice(libraries.indexOf(asset), 1);
  }
});

it('changes a referenced technology without coupling independent connector diameters', () => {
  const json = definition(),
    entity = element(['d1', 'd2', 'tech']);
  json.entities.example = entity;
  entity.variables[0].defaultValues = [10];
  entity.variables[1].defaultValues = [10];
  entity.variables[2].valueTypeCode = 3;
  entity.variables[2].defaultValues = ['A'];
  entity.variables[2].options = [{ value: 'A' }, { value: 'B' }];
  for (const [id, diameter, external] of [
    ['A', 10, 12],
    ['B', 20, 24],
  ] as const) {
    json.specifications[id] = {
      guid: id,
      id: 'Pipe',
      columns: ['d', 'dint', 'dext'],
      arrayAttributes: { COLS: 1 },
      dataColumns: [diameter, diameter - 2, external].map((value) => [['plain', [value]], { typeCode: 2 }]),
    };
    json.technologies[id] = {
      id,
      guid: id,
      names: {},
      sizeTableName: 'Pipe',
      tableRefs: [id],
      connectionCodes: [],
      properties: { REPRESENTATION: 0 },
    };
  }
  entity.connectors = ['d1', 'd2'].map((name, index) => ({
    id: name,
    attributes: { TYPE: 12 },
    conditionsRaw: {},
    fields: { DIR: 1 },
    diameterExpression: name,
    technologyExpression: index === 0 ? '%tech' : 'A',
    positionExpressions: { X: '0', Y: '0', Z: '0' },
  }));
  const model = createJsonLibrary('NewLibrary', json, { entity: { entry: 'makeTest' } }).elements[0];
  const initial = model.resolve!();
  expect(initial.snapshot?.status).toBe('valid');
  const next = model.resolve!(new Map([...initial.values, ['tech', 'B']]), ['tech']);
  expect(next.errors).toEqual([]);
  expect(Object.fromEntries(next.values)).toMatchObject({
    tech: 'B',
    d1: '20',
    d2: '10',
    'd1:get_ext_diam': '24',
    'd2:get_ext_diam': '12',
  });
  expect(next.options.get('d1')).toEqual(['20']);
  expect(next.options.get('d2')).toEqual(['10']);
});

it('resolves supported CGeneral entries and blocks missing source references explicitly', () => {
  const source = JSON.parse(readFileSync('libraries/CGeneral/CGeneral.json', 'utf8'));
  const parsed = readParsedLibrary(source);
  const registry = geometryRegistry(readFileSync('public/demo/code/CGeneral/CGeneral.h', 'utf8'));
  const entries = Object.fromEntries(
    Object.values(parsed.entities).map((e) => {
      const block = e.geometry?.children.find((node) => node.tag === 'FNBLKNAME')?.text ?? '';
      const entry = registry.get(block);

      return [e.guid, { entry: entry ?? '', ...(!entry ? { error: 'Missing registered geometry' } : {}) }];
    }),
  );
  const library = createJsonLibrary('CGeneral', source, entries);
  const pipe = library.elements.find((e) => e.symbol === 'PWLD')!.resolve!();
  expect(pipe.snapshot?.status).toBe('valid');
  expect(pipe.errors).toEqual([]);
  const invalid = library.elements.find((e) => e.symbol === 'IF')!.resolve!();
  expect(invalid.snapshot?.status).toBe('unresolved');
  expect(invalid.errors?.length).toBeGreaterThan(0);
  expect(library.elements.filter((e) => !e.error)).toHaveLength(180);
  for (const e of library.elements.filter((e) => !e.error)) {
    const result = e.resolve!();
    expect(result.snapshot).toBeDefined();
    if (result.snapshot!.status === 'valid') expect(result.errors).toEqual([]);
    else expect(result.errors?.length, e.symbol).toBeGreaterThan(0);
  }
});

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { libraries } from '@/features/element-library/config/libraries';
import { CGeneral } from '@tests/libraryData';
import { readParsedLibrary, SpecificationIndex } from '@/features/element-library/model/parsedLibrary';
import { CompiledConstraintGraph, UnifiedConstraintSolver } from '@/features/element-library/model/constraintGraph';

it('has one JSON source per library and no legacy parameter catalog or resolver', () => {
  for (const asset of libraries) {
    expect(readdirSync(`libraries/${asset.name}`).filter((f) => f.endsWith('.json'))).toHaveLength(1);
    expect(existsSync(`src/features/element-library/data/${asset.name}.ts`)).toBe(false);
    expect(existsSync(`src/features/element-library/data/rules/${asset.name}.json`)).toBe(false);
  }
  for (const f of ['valueTables.ts', 'xmlRules.ts']) expect(existsSync('src/features/element-library/model/' + f)).toBe(false);
});

it.each(libraries)('returns a graph snapshot for every $name entity, including blocked definitions', async (asset) => {
  const library = await asset.load();
  const parsed = readParsedLibrary(JSON.parse(readFileSync(`libraries/${asset.name}/${asset.name}.json`, 'utf8')));
  expect(library.elements).toHaveLength(Object.keys(parsed.entities).length);
  for (const element of library.elements) {
    const result = element.resolve();
    expect(result.snapshot, element.id).toBeDefined();
    expect(result.values).toEqual(result.snapshot.resolvedValues);
    expect(result.options).toEqual(result.snapshot.validOptions);
    if (result.snapshot.status === 'valid') expect(result.errors).toEqual([]);
    else expect(result.errors?.length, element.symbol).toBeGreaterThan(0);
  }
  for (const table of Object.values(parsed.specifications))
    expect(() => new SpecificationIndex(table), table.guid).not.toThrow();
});

it('solves all four CRBWLD diameters together and synchronizes dependent dimensions after every edit', () => {
  const element = CGeneral.elements.find((e) => e.id === '46E26C39-597F-4EEF-A202-A1E5F6A7E3B6')!;
  let result = element.resolve();
  for (const [name, value] of [['d2','32'],['d3','40'],['d4','25'],['d1','20']]) {
    result = element.resolve(new Map(result.values).set(name, value), [name]);
    expect(result.snapshot.status, result.errors?.join('; ')).toBe('valid');
    for (const port of [1,2,3,4]) expect(result.values.get('d' + port)).toBe(value);
    expect(new Set([1,2,3,4].map((p) => result.values.get('d' + p + 'ext'))).size).toBe(1);
    expect(result.connectors.every((c) => c.physical?.resolvedSize?.diameter === Number(value))).toBe(true);
    expect(result.snapshot.affectedGroups.length).toBeGreaterThan(0);
  }
  expect(result.values.get('l5')).toBe('0');
  expect(Number(result.values.get('l1'))).toBeGreaterThanOrEqual(32);
});

it('rejects the mixed diameter configuration from the screenshot instead of generating a detached ring', () => {
  const element = CGeneral.elements.find((e) => e.symbol === 'CRBWLD')!;
  const before = element.resolve();
  const values = new Map(before.values);
  for (const [name, value] of [['d1','20'],['d2','32'],['d3','32'],['d4','32']]) values.set(name, value);
  const invalid = element.resolve(values, ['d1','d2','d3','d4']);
  expect(invalid.snapshot.status).toBe('conflict');
  expect(invalid.snapshot.conflicts.some((c) => c.code === 'TABLE_CONFLICT')).toBe(true);
  expect(element.resolve()).toEqual(before);
});

it('solves independent domains without expanding a billion combinations', () => {
  const json = readParsedLibrary({ schemaVersion: '2.1-columnar-en', library: {}, entities: {
    e: { id:'e', guid:'e', variables:[], restrictions:['A','B','H'].map((variable,index) => ({ index, typeCode:1, tableGuid:variable, conditionsRaw:{}, extraFields:[], bindings:[{variable,columnKey:0,levelCode:0,bindingTypeCode:1}] })) }
  }, specifications: Object.fromEntries(['A','B','H'].map((name) => [name, {guid:name,id:name,columns:[name],arrayAttributes:{COLS:1000},dataColumns:[[['plain',Array.from({length:1000},(_,i)=>String(i+1))],{typeCode:2}]]}])) });
  const solver = new UnifiedConstraintSolver(new CompiledConstraintGraph(json,json.entities.e));
  const result = solver.solve(new Map([['A','10'],['B','20']]),['A','B']);
  expect(result.status).toBe('valid');
  expect(Object.fromEntries(result.resolvedValues)).toEqual({A:'10',B:'20',H:'1'});
  expect(result.validOptions.get('H')).toHaveLength(1000);
});

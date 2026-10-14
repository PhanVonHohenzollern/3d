import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { defineLibrary, type TableElement } from '@/features/element-library/model/valueTables';
import { libraries } from '@/features/element-library/config/libraries';
import CGeneral from '@/features/element-library/data/CGeneral';

it.each(CGeneral.elements.filter((element) => element.entry === 'makeCHIL'))(
  'retains every conditional diameter/technology pair for $name',
  (element) => {
    const sizes = (tech: string) => element.resolve!(new Map([['tech', tech]]), ['tech']).options.get('diam') ?? [];

    expect(sizes('threaded steel')).toHaveLength(15);
    expect(sizes('welded steel')).toHaveLength(19);
    expect(sizes('flanged steel')).toHaveLength(16);
    expect(sizes('copper')).toHaveLength(15);
    expect(sizes('glued plastic')).toHaveLength(19);
    expect(sizes('socked-welded plastic')).toHaveLength(19);
    expect(sizes('butt-welded plastic')).toHaveLength(19);
    expect(sizes('welded steel')).toContain('25');
    expect(sizes('flanged steel')).toContain('25');
    expect(sizes('copper')).toContain('15');
    expect(element.resolve!().connectors.every((link) => !!link.connectionType && !!link.technology)).toBe(true);
  },
);

it('uses the XML fancoil dimension columns and four-pipe spacing for the selected technology', () => {
  const element = CGeneral.elements.find((element) => element.name === 'Floor standing fancoil')!;

  const defaults = (diam: string, tech: string, system: string) =>
    element.variants.find(
      (v) => v.selection.diam === diam && v.selection.tech === tech && v.selection.system_label === system,
    )!;

  expect(defaults('25', 'threaded steel', '2-pipe').defaults.d).toBe('39.7');
  expect(defaults('25', 'welded steel', '2-pipe').defaults.d).toBe('33.7');
  expect(defaults('25', 'flanged steel', '2-pipe').defaults.d).toBe('115');
  const fourPipe = defaults('150', 'flanged steel', '4-pipe');
  expect(fourPipe.defaults).toMatchObject({ B: '750', H: '750', d: '285', ftype: '2' });
  expect(fourPipe.connectors).toHaveLength(4);
});

it('joins compatible size rows and keeps independent options without inventing combinations', () => {
  const element: TableElement = {
    id: 'example',
    name: 'Example',
    symbol: 'Example',
    entry: 'makeExample',
    defaults: { thickness: '5' },
    connectors: [],
    selectors: [
      { name: 'diam', label: 'Diameter' },
      { name: 'side', label: 'Side' },
    ],
    tables: [
      {
        columns: ['diam', 'L'],
        rows: [
          ['25', '100'],
          ['32', '120'],
        ],
      },
      {
        columns: ['diam', 'H'],
        rows: [
          ['25', '40'],
          ['40', '60'],
        ],
      },
      { columns: ['side'], rows: [['Left'], ['Right']] },
    ],
  };
  const result = defineLibrary('test', [element]);
  expect(
    result.elements[0].variants.map((variant) => ({ ...result.elements[0].defaults, ...variant.defaults })),
  ).toEqual([
    { thickness: '5', diam: '25', L: '100', H: '40', side: 'Left' },
    { thickness: '5', diam: '25', L: '100', H: '40', side: 'Right' },
  ]);
});

it('retains the XML FANUTAC dimension pairs and UNION length constraints', async () => {
  const library = await libraries.find((library) => library.name === 'CGeneral')!.load();
  const fan = library.elements.find((element) => element.id === 'D669A1F7-F5DE-4955-8C18-01EF78273DDB')!;
  expect([...new Set(fan.variants.map((variant) => `${variant.selection.A}/${variant.selection.C}`))]).toEqual([
    '520/180',
    '600/180',
    '870/200',
    '1170/200',
  ]);
  const union = library.elements.find((element) => element.entry === 'makeUNION')!;

  const values = (d2: string) =>
    union.variants.find(
      (variant) =>
        variant.selection.d1 === '10' &&
        variant.selection.d2 === d2 &&
        variant.selection.tech1 === 'threaded steel' &&
        variant.selection.tech2 === 'threaded steel',
    )!.defaults;

  expect(values('15')).toMatchObject({ l1: '12', l2: '15', L: '27' });
  expect(values('65')).toMatchObject({ l1: '12', l2: '35', L: '65' });
});

it('keeps the prepared tables small and removes the expanded JSON catalogue', () => {
  const directory = 'src/features/element-library/data';
  const files = readdirSync(directory);
  expect(files.sort()).toEqual(['BELIMO.ts', 'CGeneral.ts', 'GRUNDFOS.ts', 'rules']);
  expect(
    files
      .filter((file) => file.endsWith('.ts'))
      .reduce((total, file) => total + statSync(`${directory}/${file}`).size, 0),
  ).toBeLessThan(800 * 1024);
  expect(readdirSync('public/demo')).toEqual(['code']);
  const ruleFiles = readdirSync(`${directory}/rules`);
  expect(ruleFiles.sort()).toEqual(['BELIMO.json', 'CGeneral.json', 'GRUNDFOS.json']);
  // Budget the actual wire representation, independent of source indentation.
  const ruleBytes = ruleFiles.map((file) => readFileSync(`${directory}/rules/${file}`));
  expect(ruleBytes.reduce((total, bytes) => total + gzipSync(bytes).length, 0)).toBeLessThan(100 * 1024);
});

import { readdirSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { defineLibrary, type TableElement } from '@/features/element-library/model/valueTables';
import { libraries } from '@/features/element-library/config/libraries';

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
  expect(files.sort()).toEqual(['BELIMO.ts', 'CGeneral.ts', 'GRUNDFOS.ts']);
  expect(files.reduce((total, file) => total + statSync(`${directory}/${file}`).size, 0)).toBeLessThan(800 * 1024);
  expect(readdirSync('public/demo')).toEqual(['code']);
});

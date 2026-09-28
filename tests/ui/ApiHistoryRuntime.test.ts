import { describe, expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime/GeometryRuntime';
import type { RuntimeResult } from '@engine/runtime/RuntimeTypes';
import { ApiHistoryDialogModel } from '@/hooks/apiTrace/ApiHistoryDialogModel';
import { HistoryColumn } from '@/hooks/apiTrace/historyItems';
import type { TreeWidgetItem } from '@/shared/ui/tree';

function execute(source: string): RuntimeResult {
  const result = new GeometryRuntime().executeUpToLine(source, 999, true);
  expect(result.diagnostics).toEqual([]);

  return result;
}

function dialogFor(result: RuntimeResult, name: string, occurrence = 0): ApiHistoryDialogModel {
  const indices = result.apiCalls.flatMap((call, index) => (call.name === name ? [index] : []));
  expect(indices.length).toBeGreaterThan(occurrence);

  return new ApiHistoryDialogModel(result, indices[occurrence]);
}

function changes(item: TreeWidgetItem): string[][] {
  return item
    .children()
    .map((child) =>
      [HistoryColumn.Variable, HistoryColumn.Expression, HistoryColumn.Before, HistoryColumn.Value].map((column) =>
        child.text(column),
      ),
    );
}

describe('Earlier values from runtime execution', () => {
  it('keeps the makeBG height change for both copied points and excludes later writes and callee locals', () => {
    const result = execute(`short makeDV() {
  FdPoint3d cP;
  cP.z += makeBG(cP);
  FdPoint3d fullPoints[2] = { cP, cP };
  fullPoints[0].x += 1;
  fullPoints[1].z += 30;
  makeVerySimpleTube(fullPoints, 50, cpx);
  cP.z = 99;
  fullPoints[0].z = 99;
  return 0;
}
double makeBG(FdPoint3d cP) {
  double d = 7;
  cP.z += 0.25 * d;
  return 0.5 * d;
}`);
    const points = dialogFor(result, 'makeVerySimpleTube').tree.topLevelItem(0);
    expect(points.child(0).text(HistoryColumn.Value)).toBe('(1, 0, 3.5)');
    expect(points.child(1).text(HistoryColumn.Value)).toBe('(0, 0, 33.5)');
    for (let i = 0; i < 2; ++i) {
      expect(changes(points.child(i))).toEqual([
        [`fullPoints[${i}]`, 'cP', '\u2014', '(0, 0, 3.5)'],
        ['cP.z', 'makeBG(cP)', '0', '3.5'],
        ['cP', '', '\u2014', '(0, 0, 0)'],
      ]);
    }
  });

  it('keeps every dependency in a copy chain at the time each value was copied', () => {
    const result = execute(`double a = 2;
double b = a;
double c = b;
a = 9;
makeFlatDisc(FdPoint3d(), vz, c, cpx);
c = 99;`);
    const diameter = dialogFor(result, 'makeFlatDisc').tree.topLevelItem(2);
    expect(diameter.text(HistoryColumn.Value)).toBe('2');
    expect(changes(diameter)).toEqual([
      ['b', 'a', '\u2014', '2'],
      ['a', '2', '\u2014', '2'],
    ]);
  });

  it.each([
    [
      'a * 2',
      '6',
      [
        ['a', '3', '2', '3'],
        ['a', '2', '\u2014', '2'],
      ],
    ],
    [
      'a + b',
      '7',
      [
        ['b', '4', '\u2014', '4'],
        ['a', '3', '2', '3'],
        ['a', '2', '\u2014', '2'],
      ],
    ],
  ])('keeps the latest inputs to the expression %s', (expression, value, expected) => {
    const result = execute(`double a = 2;
a = 3;
double b = 4;
makeFlatDisc(FdPoint3d(), vz, ${expression}, cpx);
a = 99;
b = 99;`);
    const diameter = dialogFor(result, 'makeFlatDisc').tree.topLevelItem(2);
    expect(diameter.text(HistoryColumn.Value)).toBe(value);
    expect(changes(diameter)).toEqual(expected);
  });

  it('keeps the array index and point sources while omitting only the displayed current change', () => {
    const result = execute(`FdPoint3d p;
p.z = 3.5;
FdPoint3d points[2] = { p, p };
int i = 1;
makeFlatDisc(points[i], vz, 50, cpx);
i = 0;`);
    const center = dialogFor(result, 'makeFlatDisc').tree.topLevelItem(0);
    expect(center.text(HistoryColumn.Value)).toBe('(0, 0, 3.5)');
    expect(changes(center)).toEqual([
      ['i', '1', '\u2014', '1'],
      ['p.z', '3.5', '0', '3.5'],
      ['p', '', '\u2014', '(0, 0, 0)'],
    ]);
  });

  it('uses each loop call snapshot and never includes future iterations or an unexecuted branch', () => {
    const result = execute(`FdPoint3d p;
for (int i = 0; i < 2; ++i) {
  p.z += 1;
  makeFlatDisc(p, vz, 50, cpx);
}
if (false) { p.z = 900; }
p.z = 99;`);
    const first = dialogFor(result, 'makeFlatDisc', 0).tree.topLevelItem(0);
    const second = dialogFor(result, 'makeFlatDisc', 1).tree.topLevelItem(0);
    expect(first.text(HistoryColumn.Value)).toBe('(0, 0, 1)');
    expect(second.text(HistoryColumn.Value)).toBe('(0, 0, 2)');
    expect(changes(first)).toEqual([['p', '', '\u2014', '(0, 0, 0)']]);
    expect(changes(second)).toEqual([
      ['p.z', '1', '0', '1'],
      ['p', '', '\u2014', '(0, 0, 0)'],
    ]);
  });

  it('does not mix different lifetimes of variables with the same name', () => {
    const result = execute(`double height = 2;
{
  double height = 100;
  makeFlatDisc(FdPoint3d(), vz, height, cpx);
}
double size = height;
makeFlatDisc(FdPoint3d(), vz, size, cpx);`);
    const diameter = dialogFor(result, 'makeFlatDisc', 1).tree.topLevelItem(2);
    expect(diameter.text(HistoryColumn.Value)).toBe('2');
    expect(changes(diameter)).toEqual([['height', '2', '\u2014', '2']]);
  });
});

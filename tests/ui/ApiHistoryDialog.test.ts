// ApiHistoryDialog: parameter history rows of one immutable API snapshot.
import { describe, expect, it, vi } from 'vitest';
import { ApiHistoryDialogModel, earlierChanges, HistoryColumn } from '../../src/ui/ApiHistoryModel';
import { directSource, displayExpression } from '../../src/ui/TraceFormatting';
import type { TreeWidgetItem } from '../../src/ui/TreeWidget';
import { p, traceResult } from './traceFixture';

const row = (item: TreeWidgetItem) => Array.from({ length: 8 }, (_, c) => item.text(c));

describe('ApiHistoryDialog', () => {
  it('lists every parameter with its current source and earlier values, newest first', () => {
    const dialog = new ApiHistoryDialogModel(traceResult(), 0);
    expect(dialog.caption).toBe('helper(p, n, 3.5, pts)');
    const tree = dialog.tree;
    expect(tree.topLevelItemCount()).toBe(4);
    const [center, normal, size, points] = [0, 1, 2, 3].map((i) => tree.topLevelItem(i));
    expect(row(center)).toEqual([
      'center',
      'p',
      'FdPoint3d',
      'FdPoint3d(a, 0, 0)',
      '',
      '(2, 0, 0)',
      '2',
      'No earlier values',
    ]);
    expect(row(normal)).toEqual([
      'normal',
      'n',
      'FdVector3d',
      'FdVector3d(0, 0, 1)',
      '',
      '(0, 0, 1)',
      '3',
      'No earlier values',
    ]);
    expect(row(size)).toEqual(['size', '', 'double', '', '', '3.5', '', 'No earlier values']);
    expect(center.isBold(HistoryColumn.Parameter)).toBe(true);

    // Arrays are expanded, so their summary moves to the element rows.
    expect(points.isExpanded()).toBe(true);
    expect(points.text(HistoryColumn.Value)).toBe('');
    expect(points.text(HistoryColumn.State)).toBe('At API call');
    const q = points.child(1);
    expect(row(q)).toEqual(['points[1]', 'pts[1]', 'FdPoint3d', 'q', '', '(1, 1, 0)', '7', 'At API call']);
    expect(q.childCount()).toBe(1);
    expect(row(q.child(0))).toEqual([
      '',
      'q',
      'FdPoint3d',
      'FdPoint3d(1, 1, 0)',
      '—',
      '(1, 1, 0)',
      '1',
      'Initialization',
    ]);
  });

  it('navigates only from rows with a source line on double-click', () => {
    const dialog = new ApiHistoryDialogModel(traceResult(), 0);
    const activated = vi.fn();
    dialog.setSourceActivatedCallback(activated);
    const tree = dialog.tree;
    tree.itemDoubleClicked.emit(tree.topLevelItem(0), 0); // captured definition of p
    tree.itemDoubleClicked.emit(tree.topLevelItem(2), 0); // literal: nothing to navigate to
    tree.itemDoubleClicked.emit(tree.topLevelItem(3).child(1).child(0), 0); // history entry
    expect(activated.mock.calls).toEqual([[2], [1]]);
  });

  it('closes like a QDialog with WA_DeleteOnClose', () => {
    const dialog = new ApiHistoryDialogModel(traceResult(), 1);
    const closed = vi.fn();
    dialog.onClosed(closed);
    dialog.close();
    dialog.close();
    expect(dialog.isOpen()).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('follows dependencies but stops at the captured history boundary', () => {
    const result = traceResult();
    expect(earlierChanges(result, [{ name: 'a', value: 2, variableId: 1, historyEnd: 4 }])).toEqual([0]);
    expect(earlierChanges(result, [{ name: 'a', value: 2, variableId: 1, historyEnd: 1 }])).toEqual([]);
  });

  it('formats expressions and matches direct sources like the C++ helpers', () => {
    expect(displayExpression(' 2.50 ', 2.5)).toBe('');
    expect(displayExpression('3', 3n)).toBe('');
    expect(displayExpression('a*2', 4)).toBe('a*2');
    const trace = {
      expression: 'pts[i].x',
      sources: [
        { name: 'i', value: 1n, variableId: 9, historyEnd: 1 },
        { name: 'pts[1]', value: p, variableId: 6, historyEnd: 9 },
      ],
      elements: [],
    };
    expect(directSource(trace, p)?.name).toBe('pts[1]');
    expect(directSource({ ...trace, expression: '-p' }, p)).toBeNull();
  });
});

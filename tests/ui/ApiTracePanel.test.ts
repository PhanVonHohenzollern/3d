// ApiTracePanel: row model built from a RuntimeResult, lazy trace rows,
// retained expansion/selection, multi-selection, mesh filter, API focus and
// the Earlier values window lifecycle.
import { describe, expect, it } from 'vitest';
import { emptyRuntimeResult } from '../../src/runtime/RuntimeTypes';
import { ApiTracePanelModel, TraceColumn } from '../../src/ui/ApiTraceModel';
import type { Modifiers } from '../../src/ui/Observable';
import type { TreeWidgetItem } from '../../src/ui/TreeWidget';
import { traceResult } from './traceFixture';

const none: Modifiers = { shift: false, control: false };
const ctrl: Modifiers = { shift: false, control: true };
const shift: Modifiers = { shift: true, control: false };

function createPanel() {
  const model = new ApiTracePanelModel();
  const events: string[] = [];
  model.setSelectionChangedCallback((apiIndex) => events.push(`selection:${apiIndex}`));
  model.setSourceActivatedCallback((line) => events.push(`source:${line}`));
  model.setHistorySourceActivatedCallback((line) => events.push(`history:${line}`));
  return { model, tree: model.m_tree, events };
}

const texts = (item: TreeWidgetItem) => Array.from({ length: TraceColumn.ColumnCount }, (_, c) => item.text(c));
const names = (items: readonly TreeWidgetItem[]) => items.map((item) => item.text(TraceColumn.Name));

function click(model: ApiTracePanelModel, item: TreeWidgetItem, modifiers = none) {
  model.m_tree.mousePressEvent({ item, column: 1, modifiers, onDecoration: false });
  model.m_tree.mouseReleaseEvent({ item, column: 1, modifiers, onDecoration: false });
}

function doubleClick(model: ApiTracePanelModel, item: TreeWidgetItem) {
  click(model, item);
  model.m_tree.mouseDoubleClickEvent({ item, column: 1, modifiers: none, onDecoration: false });
  model.m_tree.mouseReleaseEvent({ item, column: 1, modifiers: none, onDecoration: false });
}

function toggleBranch(model: ApiTracePanelModel, item: TreeWidgetItem) {
  model.m_tree.mousePressEvent({ item, column: 0, modifiers: none, onDecoration: true });
  model.m_tree.mouseReleaseEvent({ item, column: 0, modifiers: none, onDecoration: true });
}

describe('ApiTracePanel row model', () => {
  it('builds API rows with parameter rows, nested calls and captured values', () => {
    const { model, tree, events } = createPanel();
    model.setRuntimeResult(traceResult());
    expect(events).toEqual(['selection:-1']);
    expect(tree.topLevelItemCount()).toBe(1);
    const api = tree.topLevelItem(0);
    expect(texts(api)).toEqual(['1', 'helper', 'C++', 'helper(p, n, 3.5, pts)', '', '', '', '', '', '5']);
    expect(names(api.children())).toEqual(['center (p)', 'normal (n)', 'size', 'points', 'inner']);

    const [center, normal, size, points, inner] = api.children();
    expect(texts(center)).toEqual(['', 'center (p)', 'FdPoint3d', 'FdPoint3d(a, 0, 0)', '', '2', '0', '0', '', '2']);
    expect(texts(normal)).toEqual(['', 'normal (n)', 'FdVector3d', 'FdVector3d(0, 0, 1)', '', '0', '0', '1', '', '3']);
    // Literal expressions that repeat the value are omitted.
    expect(texts(size)).toEqual(['', 'size', 'double', '', '3.5', '', '', '', '', '']);
    expect(points.text(TraceColumn.Value)).toBe('{(2, 0, 0), (1, 1, 0)}');
    expect(points.text(TraceColumn.Line)).toBe('7');
    expect(names(points.children())).toEqual(['pts[0]', 'pts[1]']);
    expect(texts(inner).slice(0, 4)).toEqual(['2', 'inner', 'C++', 'inner(c)']);
    expect(inner.child(0).text(TraceColumn.Name)).toBe('c');
  });

  it('loads trace rows only on explicit expansion', () => {
    const { model, tree, events } = createPanel();
    model.setRuntimeResult(traceResult());
    const center = tree.topLevelItem(0).child(0);
    expect(center.hasChildIndicator()).toBe(true);
    expect(center.childCount()).toBe(0);

    events.length = 0;
    toggleBranch(model, center);
    expect(center.isExpanded()).toBe(true);
    expect(events).toEqual(['selection:-1']); // itemExpanded re-applies the selection
    expect(center.childCount()).toBe(1);
    const a = center.child(0);
    expect(texts(a)).toEqual(['', 'a', 'double', '', '2', '', '', '', 'Source variable', '1']);
    // The later write a = 3 (line 4) does not leak into the snapshot.
    expect(a.hasChildIndicator()).toBe(false);
  });

  it('suppresses the collapsed array summary while the array is expanded', () => {
    const { model, tree } = createPanel();
    model.setRuntimeResult(traceResult());
    const points = tree.topLevelItem(0).child(3);
    toggleBranch(model, tree.topLevelItem(0));
    toggleBranch(model, points);
    expect(points.text(TraceColumn.Value)).toBe('');
    toggleBranch(model, points);
    expect(points.text(TraceColumn.Value)).toBe('{(2, 0, 0), (1, 1, 0)}');
  });

  it('retains expanded branches and the selected trace row across refreshes', () => {
    const { model, tree, events } = createPanel();
    model.setRuntimeResult(traceResult());
    toggleBranch(model, tree.topLevelItem(0));
    const center = tree.topLevelItem(0).child(0);
    toggleBranch(model, center);
    events.length = 0;
    click(model, center.child(0));
    expect(events).toEqual(['selection:0', 'source:1']);
    expect(model.selectedDebugItems()).toEqual(new Set(['@api0:point:center']));

    events.length = 0;
    model.setRuntimeResult(traceResult());
    expect(events).toEqual(['selection:0']);
    const newCenter = tree.topLevelItem(0).child(0);
    expect(newCenter).not.toBe(center);
    expect(newCenter.isExpanded()).toBe(true);
    expect(newCenter.childCount()).toBe(1);
    expect(newCenter.child(0).isSelected()).toBe(true);
    expect(tree.currentItem()).toBe(newCenter.child(0));
    expect(model.selectedApiCall()).toBe(0);
    expect(model.selectedSourceLines()).toEqual(new Set([1]));
  });

  it('supports Ctrl toggling and Shift ranges from the persistent anchor', () => {
    const { model, tree } = createPanel();
    model.setRuntimeResult(traceResult());
    const api = tree.topLevelItem(0);
    toggleBranch(model, api);
    const [center, normal, size, points] = api.children();

    click(model, center);
    click(model, points, ctrl);
    expect(names(tree.selectedItems())).toEqual(['center (p)', 'points']);
    expect(model.selectedDebugItems()).toEqual(
      new Set(['@api0:point:center', '@api0:point:points[0]', '@api0:point:points[1]']),
    );
    expect(model.selectedSourceLines()).toEqual(new Set([2, 7]));

    click(model, size, shift); // anchor is still `points` (Shift does not move it)
    expect(names(tree.selectedItems())).toEqual(['size', 'points']);
    click(model, center, shift);
    expect(names(tree.selectedItems())).toEqual(['center (p)', 'normal (n)', 'size', 'points']);
    expect(model.selectedApiCalls()).toEqual(new Set([0]));
    expect(tree.currentItem()).toBe(center);

    click(model, normal, ctrl);
    expect(tree.selectedItems()).not.toContain(normal);
  });

  it('selects API parameter debug items from the viewport and activates their source line', () => {
    const { model, tree, events } = createPanel();
    model.setRuntimeResult(traceResult());
    events.length = 0;
    model.selectDebugItems(new Set(['@api0:vector:normal', '@api0:point:points[1]']));
    expect(events).toEqual(['selection:0', 'source:7']);
    const api = tree.topLevelItem(0);
    expect(api.isExpanded()).toBe(true);
    expect(api.child(3).isExpanded()).toBe(true);
    expect(tree.currentItem()).toBe(api.child(3).child(1));
    expect(model.selectedDebugItems()).toEqual(new Set(['@api0:vector:normal', '@api0:point:points[1]']));
  });

  it('filters the tree to a mesh API call and clears the filter with the API focus', () => {
    const { model, tree, events } = createPanel();
    model.setRuntimeResult(traceResult());
    events.length = 0;
    model.selectMeshApiCall(1);
    expect(events).toEqual(['selection:1']);
    expect(model.meshApiCall()).toBe(1);
    expect(model.selectedApiCall()).toBe(1);
    expect(tree.rootItem()).toBe(tree.topLevelItem(0));
    expect(names(tree.visibleRows().map((row) => row.item))).toEqual(['inner']);

    events.length = 0;
    model.clearApiFocus();
    expect(events).toEqual(['selection:-1']);
    expect(model.meshApiCall()).toBe(-1);
    expect(tree.rootItem()).toBeNull();
    expect(tree.selectedItems()).toEqual([]);

    model.selectMeshApiCall(7); // no such call: clears the focus
    expect(events.at(-1)).toBe('selection:-1');
  });

  it('opens one Earlier values window per API, reuses it and closes it on new results', () => {
    const { model, tree, events } = createPanel();
    model.setRuntimeResult(traceResult());
    const api = tree.topLevelItem(0);
    toggleBranch(model, api);
    doubleClick(model, api.child(1));
    const dialog = model.historyDialog();
    expect(dialog?.apiIndex()).toBe(0);
    expect(dialog?.windowTitle).toBe('Earlier values - API #1 helper - line 5');

    doubleClick(model, api.child(0));
    expect(model.historyDialog()).toBe(dialog);

    doubleClick(model, api.child(4));
    expect(model.historyDialog()?.apiIndex()).toBe(1);
    expect(dialog?.isOpen()).toBe(false);

    model.historyDialog()!.tree.itemDoubleClicked.emit(model.historyDialog()!.tree.topLevelItem(0), 0);
    expect(events).not.toContain('history:0');

    model.setRuntimeResult(emptyRuntimeResult());
    expect(model.historyDialog()).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { TreeWidget, TreeWidgetItem } from '@/shared/ui/tree';

const named = (parent: TreeWidget | TreeWidgetItem, name: string): TreeWidgetItem => {
  const item = new TreeWidgetItem(parent);
  item.setText(0, name);

  return item;
};

const names = (items: Iterable<TreeWidgetItem>): string[] => [...items].map((item) => item.text(0));

describe('TreeWidget', () => {
  it('walks every item depth first', () => {
    const tree = new TreeWidget();
    const a = named(tree, 'a');
    named(named(a, 'a1'), 'a1x');
    named(a, 'a2');
    named(tree, 'b');

    expect(names(tree.allItems())).toEqual(['a', 'a1', 'a1x', 'a2', 'b']);
  });

  it('visits children added to an item while the walk is on it', () => {
    const tree = new TreeWidget();
    named(tree, 'a');
    named(tree, 'b');
    const visited: string[] = [];
    for (const item of tree.allItems()) {
      visited.push(item.text(0));
      if (item.text(0) === 'a') named(item, 'a1');
    }

    expect(visited).toEqual(['a', 'a1', 'b']);
  });

  it('reports a selection change only when an item actually changes', () => {
    const tree = new TreeWidget();
    const item = named(tree, 'a');
    let changes = 0;
    tree.itemSelectionChanged.connect(() => ++changes);

    item.setSelected(false);
    expect(changes).toBe(0);
    item.setSelected(true);
    item.setSelected(true);
    expect(changes).toBe(1);
    expect(tree.selectedItems()).toEqual([item]);
    item.setSelected(false);
    expect(changes).toBe(2);
    expect(tree.selectedItems()).toEqual([]);
  });

  it('rebuilds a wide tree in linear time', () => {
    const tree = new TreeWidget();
    const parent = named(tree, 'many');
    for (let i = 0; i < 5000; ++i) named(named(parent, `call ${i}`), 'arg');

    const start = performance.now();
    for (const item of tree.allItems()) item.setSelected(false);

    // Quadratic walks took seconds here; linear ones take a few milliseconds.
    expect(performance.now() - start).toBeLessThan(500);
  });
});

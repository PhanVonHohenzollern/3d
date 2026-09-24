import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugLabelPanel } from '../../src/core/viewport/DebugLabelPanel';
import type { DebugLabelEntry } from '../../src/types/viewportEngine';
import { qColor } from '../../src/utils/painting';
import { LeftButton, NoModifier, RightButton } from '../../src/helpers/qtInput';
import { elidedText } from '../../src/utils/textMetrics';
import { fixedMeasurer } from './helpers';

const ROW = 24;

const entries = (count: number): DebugLabelEntry[] =>
  Array.from({ length: count }, (_, i) => ({ id: `id${i}`, name: `name${i}`, value: `(${i}, 0, 0)` }));

function panelWith(count: number, height = 25 + count * ROW) {
  const panel = new DebugLabelPanel('Points', qColor(255, 174, 52));
  panel.setTextMeasurer(fixedMeasurer);
  const activated = vi.fn();
  panel.setActivatedCallback(activated);
  panel.setEntries(entries(count), new Set());
  panel.setGeometry(8, 8, 200, height);
  panel.setVisible(true);

  return { panel, activated };
}

const at = (row: number) => row * ROW + ROW / 2;

const ctrl = { ...NoModifier, control: true };
const shift = { ...NoModifier, shift: true };

function click(panel: DebugLabelPanel, row: number, modifiers = NoModifier, button = LeftButton) {
  panel.mousePressEvent(20, at(row), button, modifiers);
  panel.mouseReleaseEvent(20, at(row), button, modifiers);
}

const selectedRows = (panel: DebugLabelPanel) =>
  panel
    .entries()
    .map((_, row) => row)
    .filter((row) => panel.isRowSelected(row));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DebugLabelPanel', () => {
  it('reports the header, content height and ids', () => {
    const { panel } = panelWith(3);
    expect(panel.headerText()).toBe('Points  (3)');
    expect(panel.contentHeight()).toBe(25 + 3 * ROW);
    expect(panel.itemIds()).toEqual(new Set(['id0', 'id1', 'id2']));
  });

  it('click selects one row', () => {
    const { panel, activated } = panelWith(5);
    click(panel, 2);
    expect(selectedRows(panel)).toEqual([2]);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id2']), false);
  });

  it('Ctrl-click toggles rows additively', () => {
    const { panel, activated } = panelWith(5);
    click(panel, 1);
    click(panel, 3, ctrl);
    expect(selectedRows(panel)).toEqual([1, 3]);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id1', 'id3']), true);
    click(panel, 1, ctrl);
    expect(selectedRows(panel)).toEqual([3]);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id3']), true);
  });

  it('Shift-click selects the range from the anchor', () => {
    const { panel, activated } = panelWith(6);
    click(panel, 4);
    click(panel, 1, shift);
    expect(selectedRows(panel)).toEqual([1, 2, 3, 4]);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id1', 'id2', 'id3', 'id4']), true);
    click(panel, 5, shift);
    expect(selectedRows(panel)).toEqual([4, 5]);
  });

  it('Ctrl+Shift-click adds the range to the selection', () => {
    const { panel } = panelWith(8);
    click(panel, 0);
    click(panel, 6, ctrl);
    click(panel, 4, { ...NoModifier, control: true, shift: true });
    expect(selectedRows(panel)).toEqual([0, 4, 5, 6]);
  });

  it('plain click on a selected row reduces the selection on release', () => {
    const { panel, activated } = panelWith(5);
    click(panel, 1);
    click(panel, 3, ctrl);
    panel.mousePressEvent(20, at(3), LeftButton, NoModifier);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id1', 'id3']), false);
    panel.mouseReleaseEvent(20, at(3), LeftButton, NoModifier);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id3']), false);
  });

  it('click on empty space clears on release', () => {
    const { panel, activated } = panelWith(3, 25 + 10 * ROW);
    click(panel, 1);
    panel.mousePressEvent(20, at(7), LeftButton, NoModifier);
    panel.mouseReleaseEvent(20, at(7), LeftButton, NoModifier);
    expect(selectedRows(panel)).toEqual([]);
    expect(activated).toHaveBeenLastCalledWith(new Set(), false);
  });

  it('right-click selects an unselected row but never extends with modifiers', () => {
    const { panel } = panelWith(4);
    click(panel, 0);
    click(panel, 2, NoModifier, RightButton);
    expect(selectedRows(panel)).toEqual([2]);
    click(panel, 3, ctrl, RightButton);
    expect(selectedRows(panel)).toEqual([2]);
  });

  it('drag selects the rows between press and pointer', () => {
    const { panel, activated } = panelWith(6);
    panel.mousePressEvent(20, at(1), LeftButton, NoModifier);
    panel.mouseMoveEvent(20, at(4), LeftButton, NoModifier);
    expect(selectedRows(panel)).toEqual([1, 2, 3, 4]);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id1', 'id2', 'id3', 'id4']), false);
    panel.mouseMoveEvent(20, at(2), LeftButton, NoModifier);
    expect(selectedRows(panel)).toEqual([1, 2]);
    panel.mouseReleaseEvent(20, at(2), LeftButton, NoModifier);
    expect(selectedRows(panel)).toEqual([1, 2]);
  });

  it('keyboard: arrows move the selection, Shift extends, Ctrl+A selects all', () => {
    const { panel, activated } = panelWith(5);
    click(panel, 1);
    expect(panel.keyPressEvent('ArrowDown', NoModifier)).toBe(true);
    expect(selectedRows(panel)).toEqual([2]);
    panel.keyPressEvent('ArrowDown', shift);
    panel.keyPressEvent('ArrowDown', shift);
    expect(selectedRows(panel)).toEqual([2, 3, 4]);
    expect(activated).toHaveBeenLastCalledWith(new Set(['id2', 'id3', 'id4']), true);
    panel.keyPressEvent('ArrowUp', shift);
    expect(selectedRows(panel)).toEqual([2, 3]);
    panel.keyPressEvent('a', ctrl);
    expect(selectedRows(panel)).toEqual([0, 1, 2, 3, 4]);
    expect(panel.keyPressEvent('Escape', NoModifier)).toBe(false);
  });

  it('setEntries() applies an external selection without activating', () => {
    const { panel, activated } = panelWith(4);
    panel.setEntries(entries(4), new Set(['id0', 'id2']));
    expect(selectedRows(panel)).toEqual([0, 2]);
    expect(activated).not.toHaveBeenCalled();
    const changed = entries(4).map((e) => ({ ...e, value: `${e.value}!` }));
    panel.setEntries(changed, new Set(['id2']));
    expect(selectedRows(panel)).toEqual([2]);
  });

  it('selectedRowRect() maps the visible selected row into the viewport', () => {
    const { panel } = panelWith(4);
    panel.setEntries(entries(4), new Set(['id1']));
    const rect = panel.selectedRowRect('id1');
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([8, 8 + 25 + ROW, 200, ROW]);
    expect(rect.right()).toBe(8 + 200 - 1);
    expect(panel.selectedRowRect('id0').isEmpty()).toBe(true);
    panel.setVisible(false);
    expect(panel.selectedRowRect('id1').isEmpty()).toBe(true);
  });

  it('scrolls a newly selected row into view and clips its rect', () => {
    const { panel } = panelWith(20, 25 + 5 * ROW);
    expect(panel.hasScrollBar()).toBe(true);
    expect(panel.viewportWidth()).toBe(192);
    panel.setEntries(entries(20), new Set(['id12']));
    expect(panel.scrollValue()).toBe(13 * ROW - 5 * ROW);
    const rect = panel.selectedRowRect('id12');
    expect([rect.y, rect.height, rect.width]).toEqual([8 + 25 + 4 * ROW, ROW, 192]);
    panel.setScrollValueFromView(0);
    expect(panel.selectedRowRect('id12').isEmpty()).toBe(true);
    panel.setScrollValueFromView(10_000);
    expect(panel.scrollValue()).toBe(20 * ROW - 5 * ROW);
  });

  it('lays out rows like LabelDelegate (value <= 45%, name elided in the middle)', () => {
    const panel = new DebugLabelPanel('Points', qColor(255, 174, 52));
    panel.setTextMeasurer(fixedMeasurer);
    panel.setEntries(
      [{ id: 'a', name: 'averyveryverylongparametername[12]', value: '(123.456, 7890.12, 3.5)' }],
      new Set(),
    );
    panel.setGeometry(0, 0, 200, 49);
    const layout = panel.rowLayout(0);
    const contentWidth = 200 - 24;
    expect(layout.valueWidth).toBe(Math.trunc((contentWidth * 45) / 100));
    expect(layout.valueLeft).toBe(17 + contentWidth - layout.valueWidth);
    expect(layout.nameWidth).toBe(contentWidth - layout.valueWidth - 8);
    expect(layout.nameText).toContain('\u2026');
    expect(layout.nameText.startsWith('ave')).toBe(true);
    expect(layout.nameText.endsWith('2]')).toBe(true);
    expect(layout.valueText.endsWith('\u2026')).toBe(true);
    expect(fixedMeasurer.horizontalAdvance(layout.nameText, panel.font())).toBeLessThanOrEqual(layout.nameWidth);
  });
});

describe('elidedText', () => {
  const font = { family: 'x', pixelSize: 12, bold: false };
  it('returns text that fits unchanged', () => {
    expect(elidedText(fixedMeasurer, font, 'abc', 'ElideRight', 21)).toBe('abc');
  });
  it('elides on the right and in the middle like QFontMetrics', () => {
    expect(elidedText(fixedMeasurer, font, 'abcdefghij', 'ElideRight', 35)).toBe('abc\u2026');
    expect(elidedText(fixedMeasurer, font, 'abcdefghij', 'ElideMiddle', 35)).toBe('a\u2026j');
    expect(elidedText(fixedMeasurer, font, 'abcdefghij', 'ElideMiddle', 50)).toBe('abc\u2026hij');
    expect(elidedText(fixedMeasurer, font, 'abcdefghij', 'ElideRight', 5)).toBe('');
  });
});

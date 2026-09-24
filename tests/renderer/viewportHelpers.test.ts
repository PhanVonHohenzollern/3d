import { describe, expect, it } from 'vitest';
import { extendedSelectionCommand, moveCursor } from '../../src/core/viewport/listSelection';
import { debugLabelPanelsLayout } from '../../src/core/viewport/panelLayout';
import { NoModifier, RightButton, mouseButtonFromDom, wheelAngleDeltaY } from '../../src/helpers/qtInput';
import { Bounds3D } from '../../src/utils/Bounds3D';

const idle = { rowSelected: false, pressedRow: -1, dragSelecting: false };

describe('Qt input mapping', () => {
  it('converts one wheel notch to 120 angle-delta units in every delta mode', () => {
    expect(wheelAngleDeltaY({ deltaY: -100, deltaMode: 0 })).toBeCloseTo(120, 9);
    expect(wheelAngleDeltaY({ deltaY: -3, deltaMode: 1 })).toBe(120);
    expect(wheelAngleDeltaY({ deltaY: 1, deltaMode: 2 })).toBe(-120);
  });

  it('maps DOM buttons to Qt buttons', () => {
    expect([0, 1, 2, 3].map(mouseButtonFromDom)).toEqual([1, 4, 2, 0]);
  });
});

describe('ExtendedSelection commands', () => {
  it('press: plain selects, Ctrl toggles, Shift extends, selected rows wait for the release', () => {
    const press = (modifiers = NoModifier, state = idle, row = 2) =>
      extendedSelectionCommand(row, { type: 'press', button: 1, modifiers }, state);
    expect(press()).toEqual({ clear: true, op: 'Select' });
    expect(press({ ...NoModifier, control: true })).toEqual({ op: 'Toggle' });
    expect(press({ ...NoModifier, shift: true })).toEqual({ current: true, op: 'Select' });
    expect(press(NoModifier, { ...idle, rowSelected: true })).toEqual({});
    expect(press(NoModifier, idle, -1)).toEqual({ clear: true });
  });

  it('release reduces a press on a selected row to that row', () => {
    const state = { rowSelected: true, pressedRow: 3, dragSelecting: false };
    const release = extendedSelectionCommand(3, { type: 'release', button: 1, modifiers: NoModifier }, state);
    expect(release).toEqual({ clear: true, op: 'Select' });
    const rightRelease = extendedSelectionCommand(
      3,
      { type: 'release', button: RightButton, modifiers: NoModifier },
      state,
    );
    expect(rightRelease).toEqual({});
  });

  it('moves the cursor with the navigation keys', () => {
    expect(moveCursor('ArrowDown', 2, 10, 4)).toBe(3);
    expect(moveCursor('PageDown', 8, 10, 4)).toBe(9);
    expect(moveCursor('Home', 5, 10, 4)).toBe(0);
    expect(moveCursor('ArrowUp', -1, 10, 4)).toBe(0);
    expect(moveCursor('End', 0, 0, 4)).toBe(-1);
  });
});

describe('label panel layout', () => {
  const input = {
    width: 1000,
    height: 700,
    pointContentHeight: 25 + 3 * 24,
    vectorContentHeight: 25,
    showLabels: true,
    apiFocusActive: true,
  };

  it('uses 27% columns (at most 340 px) and reserves the button strip', () => {
    const layout = debugLabelPanelsLayout(input);
    expect([layout.point.x, layout.point.width, layout.point.height]).toEqual([8, 263, 97]);
    expect(layout.vector.x).toBe(1000 - 8 - 263);
    expect(layout.pointVisible).toBe(true);
    expect(layout.vectorVisible).toBe(false);
    expect(debugLabelPanelsLayout({ ...input, width: 2000 }).point.width).toBe(340);
  });

  it('hides the lists when there is no room', () => {
    expect(debugLabelPanelsLayout({ ...input, height: 70 }).pointVisible).toBe(false);
    expect(debugLabelPanelsLayout({ ...input, width: 240 }).pointVisible).toBe(false);
  });
});

describe('Bounds3D', () => {
  it('accumulates the axis-aligned extent', () => {
    const bounds = new Bounds3D();
    expect(bounds.isEmpty()).toBe(true);
    bounds.add(1, -2, 3);
    bounds.addPoint({ x: -4, y: 5, z: 0 });
    expect(bounds.minimum()).toEqual({ x: -4, y: -2, z: 0 });
    expect(bounds.maximum()).toEqual({ x: 1, y: 5, z: 3 });
  });
});

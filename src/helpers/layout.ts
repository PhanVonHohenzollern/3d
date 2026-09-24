import type { Dock, WindowGeometry } from '../types/mainWindow';

export const kDocks: readonly Dock[] = [
  { name: 'VariablesDock', title: 'Variables' },
  { name: 'ParametersDock', title: 'Parameters' },
  { name: 'ApiTraceDock', title: 'API Trace' },
  { name: 'LinkDock', title: 'Link' },
];

export const kSplitterHandleSize = 12;
export const kMinimumPaneSize = 120;
export const kTreeIndentation = 20;
const kMinimumDockHeight = 200;
const kMinimumCentralHeight = 252;

export function distributeSplitterSizes(
  sizes: [number, number],
  total: number,
  stretch: readonly [number, number],
): [number, number] {
  const current = sizes[0] + sizes[1];
  const delta = total - current;
  if (delta === 0) return sizes;
  let weights: readonly [number, number] = stretch[0] + stretch[1] > 0 ? stretch : sizes;
  if (weights[0] + weights[1] <= 0) weights = [1, 1];
  const first = Math.min(Math.max(sizes[0] + (delta * weights[0]) / (weights[0] + weights[1]), 0), Math.max(total, 0));

  return [first, Math.max(total - first, 0)];
}

export function draggedSplitterSizes(start: [number, number], delta: number): [number, number] {
  const total = start[0] + start[1];
  const minimum = Math.min(kMinimumPaneSize, total / 2);
  const first = Math.min(Math.max(start[0] + delta, minimum), total - minimum);

  return [first, total - first];
}

export function clampDockHeight(height: number, areaHeight: number): number {
  const available = Math.max(0, areaHeight - kSplitterHandleSize - 12);
  const maximum = available - Math.min(kMinimumCentralHeight, available / 2);

  return Math.min(Math.max(height, Math.min(kMinimumDockHeight, maximum)), maximum);
}

export function initialFloatingGeometry(viewportWidth: number, viewportHeight: number): WindowGeometry {
  const width = Math.max(Math.min(1380, viewportWidth - 60), 320);
  const height = Math.max(Math.min(720, viewportHeight - 60), 200);

  return {
    x: Math.max((viewportWidth - width) / 2, 0),
    y: Math.max((viewportHeight - height) / 2, 0),
    width,
    height,
  };
}

export function movedFloatingGeometry(
  start: WindowGeometry,
  dx: number,
  dy: number,
  viewportWidth: number,
  viewportHeight: number,
): WindowGeometry {
  return {
    ...start,
    x: Math.min(Math.max(start.x + dx, 40 - start.width), viewportWidth - 40),
    y: Math.min(Math.max(start.y + dy, 0), viewportHeight - 24),
  };
}

export function resizedFloatingGeometry(start: WindowGeometry, dx: number, dy: number): WindowGeometry {
  return { ...start, width: Math.max(start.width + dx, 320), height: Math.max(start.height + dy, 160) };
}

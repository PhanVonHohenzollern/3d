export const kSplitterHandleSize = 12;
export const kMinimumPaneSize = 120;

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

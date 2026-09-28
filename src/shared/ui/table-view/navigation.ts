const kPageStep = 10;

export function rowForKey(key: string, current: number, rowCount: number, pageKeys: boolean): number | null {
  if (rowCount <= 0) return null;
  const last = rowCount - 1;
  switch (key) {
    case 'ArrowUp':
      return current < 0 ? 0 : Math.max(current - 1, 0);
    case 'ArrowDown':
      return current < 0 ? 0 : Math.min(current + 1, last);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageUp':
      return pageKeys ? Math.max(current - kPageStep, 0) : null;
    case 'PageDown':
      return pageKeys ? Math.min(Math.max(current, 0) + kPageStep, last) : null;
    default:
      return null;
  }
}

export function adjacentCell(
  row: number,
  column: number,
  rowCount: number,
  columnCount: number,
  backward: boolean,
): { row: number; column: number } {
  row = Math.max(row, 0);
  column = Math.max(column, 0);
  if (!backward) {
    if (++column >= columnCount) {
      column = 0;
      row = (row + 1) % rowCount;
    }
  } else if (--column < 0) {
    column = columnCount - 1;
    row = (row - 1 + rowCount) % rowCount;
  }

  return { row, column };
}

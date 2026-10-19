import type { SpecificationIndex } from '@/features/element-library/model/parsedLibrary';

export interface NumericLookupInput {
  column: number;
  value: number;
  extrapolate: boolean;
}

// FluidLib.dll: PnDefSpecLimit::GetInterpolatedValue (RVA 0x4106C0)
// and Interpolate (0x40F120). TYPE=8 interpolates inside the table and
// holds the endpoint outside it. TYPE=9 retains both endpoint rows for
// extrapolation. Neither operation changes the formula/input argument.
export function interpolateTable(
  table: SpecificationIndex,
  rows: readonly number[],
  inputs: readonly NumericLookupInput[],
  columns: readonly number[],
): Map<number, string> {
  const visit = (candidates: readonly number[], axis: number): Map<number, string> => {
    if (!candidates.length) throw new Error('No source rows for numeric lookup');
    if (axis === inputs.length) {
      const result = new Map<number, string>();
      for (const column of columns) {
        const cells = candidates.map((row) => table.columns[column]?.[row]);
        if (cells[0] === undefined || cells.some((cell) => cell !== cells[0]))
          throw new Error(`Ambiguous numeric lookup column ${column}`);
        result.set(column, cells[0]);
      }

      return result;
    }
    const input = inputs[axis];
    const breakpoints = [...new Set(candidates.map((row) => {
      const value = table.columns[input.column]?.[row];
      if (!value?.trim() || !Number.isFinite(Number(value)))
        throw new Error(`Non-numeric lookup column ${input.column}`);

      return Number(value);
    }))].sort((a, b) => a - b);
    const lower = breakpoints.filter((point) => point <= input.value).at(-1);
    const upper = breakpoints.find((point) => point >= input.value);
    let lo = lower ?? breakpoints[0], hi = upper ?? breakpoints.at(-1)!;
    if (input.extrapolate && breakpoints.length > 1) {
      if (lower === undefined) [lo, hi] = [breakpoints[0], breakpoints[1]];
      else if (upper === undefined) [lo, hi] = breakpoints.slice(-2);
    }

    const at = (point: number) => visit(candidates.filter((row) =>
      Number(table.columns[input.column][row]) === point), axis + 1);

    const left = at(lo);
    if (lo === hi) return left;
    const right = at(hi), ratio = (input.value - lo) / (hi - lo);

    return new Map(columns.map((column) => {
      const a = left.get(column)!, b = right.get(column)!;
      if (a === b) return [column, a];
      if (!a.trim() || !b.trim() || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b)))
        throw new Error(`Cannot interpolate text column ${column}`);
      const value = Number(a) + ratio * (Number(b) - Number(a));
      if (!Number.isFinite(value)) throw new Error(`Invalid interpolation in column ${column}`);

      return [column, String(value)];
    }));
  };

  return visit(rows, 0);
}

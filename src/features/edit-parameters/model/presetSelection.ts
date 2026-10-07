export interface PresetOption {
  row: number;
  value: string;
}

// Resolve duplicate values once for the whole table, rather than rescanning every
// record for each option in each field. Earlier selectors have higher priority.
export function presetOptions(
  data: readonly ReadonlyMap<string, string>[],
  presets: readonly ReadonlyMap<string, string>[],
  selectors: readonly string[],
  current: ReadonlyMap<string, string>,
  selected: number,
): Map<string, PresetOption[]> {
  const scores = presets.map((preset) =>
    selectors.reduce(
      (score, key, priority) => score + (preset.get(key) === current.get(key) ? 2 ** (selectors.length - priority) : 0),
      0,
    ),
  );
  const choices = new Map<string, Map<string, number>>();
  for (const [index, row] of data.entries()) {
    for (const [key, value] of row) {
      let values = choices.get(key);
      if (!values) choices.set(key, (values = new Map()));
      const previous = values.get(value);
      if (
        previous === undefined ||
        scores[index] > scores[previous] ||
        (scores[index] === scores[previous] && index === selected)
      )
        values.set(value, index);
    }
  }

  return new Map([...choices].map(([key, choices]) => [key, [...choices].map(([value, row]) => ({ row, value }))]));
}

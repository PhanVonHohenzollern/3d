import type { ElementLibrary, LibraryElement, LibraryVariant } from '@/features/element-library/model/types';

export interface ValueTable {
  columns: string[];
  rows: (string | null)[][];
}

export interface TableElement extends Omit<LibraryElement, 'variants'> {
  tables: ValueTable[];
  connectorSets?: LibraryElement['connectors'][];
  derive?: (values: Readonly<Record<string, string>>) => Record<string, string>;
}

// Only matching keys are joined. Independent tables combine without storing their
// Cartesian product in the catalogue; null means that a parameter is absent.
function tableValues(tables: readonly ValueTable[]): Record<string, string | null>[] {
  let values: Record<string, string | null>[] = [{}];
  const columns = new Set<string>();
  for (const table of tables) {
    const shared = table.columns.filter((column) => columns.has(column));
    const groups = new Map<string, Record<string, string | null>[]>();
    for (const row of table.rows) {
      const value = Object.fromEntries(table.columns.map((column, index) => [column, row[index]]));
      const key = JSON.stringify(shared.map((column) => value[column]));
      const group = groups.get(key);
      if (group) group.push(value);
      else groups.set(key, [value]);
    }
    values = values.flatMap((value) => {
      const key = JSON.stringify(shared.map((column) => value[column]));

      return (groups.get(key) ?? []).map((row) => ({ ...value, ...row }));
    });
    for (const column of table.columns) columns.add(column);
  }

  return values;
}

export function defineLibrary(name: string, definitions: TableElement[]): ElementLibrary {
  return {
    name,
    elements: definitions.map(({ tables, connectorSets, derive, ...element }) => {
      let variants: LibraryVariant[] | undefined;

      return {
        ...element,
        // Listing FLM elements does not expand size combinations. Build them only
        // for an opened function, and reuse the result while switching its sizes.
        get variants() {
          return (variants ??= element.error
            ? []
            : tableValues(tables).map((row) => {
                const { $connectors, ...parameters } = row;
                const defaults = Object.fromEntries(
                  Object.entries(parameters).filter((entry): entry is [string, string] => entry[1] !== null),
                );
                const values = { ...element.defaults, ...defaults };
                Object.assign(defaults, derive?.(values));

                return {
                  selection: Object.fromEntries(
                    element.selectors.flatMap(({ name }) => (name in values ? [[name, values[name]]] : [])),
                  ),
                  defaults,
                  ...($connectors != null && connectorSets ? { connectors: connectorSets[Number($connectors)] } : {}),
                };
              }));
        },
      };
    }),
  };
}

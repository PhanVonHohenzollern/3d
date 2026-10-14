import type {
  ElementLibrary,
  LibraryElement,
  LibraryVariant,
  LibraryValues,
} from '@/features/element-library/model/types';
import {
  resolveXml,
  sameValue,
  xmlConnectors,
  xmlOptions,
  type XmlCatalog,
} from '@/features/element-library/model/xmlRules';

export interface ValueTable {
  columns: string[];
  rows: (string | null)[][];
  controls?: string[];
}

export interface TableElement extends Omit<LibraryElement, 'variants'> {
  tables: ValueTable[];
  connectorSets?: LibraryElement['connectors'][];
  derive?: (values: Readonly<Record<string, string>>) => Record<string, string>;
}

export function libraryWithXml(xml: XmlCatalog): (name: string, definitions: TableElement[]) => ElementLibrary {
  return (name, definitions) => defineLibrary(name, definitions, xml);
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

export function defineLibrary(name: string, definitions: TableElement[], xml?: XmlCatalog): ElementLibrary {
  return {
    name,
    elements: definitions.map(({ tables, connectorSets, derive, ...element }) => {
      let variants: LibraryVariant[] | undefined;
      let initial: LibraryValues | undefined;
      const rules = xml?.elements[element.id];

      const resolve: NonNullable<LibraryElement['resolve']> = (previous, changed = []) => {
        if (!previous && initial)
          return {
            values: new Map(initial.values),
            connectors: structuredClone(initial.connectors),
            options: new Map(initial.options),
          };
        const values = new Map(Object.entries(element.defaults));
        for (const [key, value] of previous ?? []) values.set(key, value);
        const dirty = new Set(changed);
        const options = new Map<string, string[]>();
        let connectors = element.connectors;
        for (const table of tables) {
          for (const [index, column] of table.columns.entries()) {
            if (!column.startsWith('$'))
              options.set(column, [...new Set(table.rows.flatMap((row) => (row[index] == null ? [] : [row[index]!])))]);
          }
          const changedColumns = table.columns.filter((column) => dirty.has(column));
          const candidates = table.rows.filter((row) =>
            changedColumns.every((column) =>
              sameValue(row[table.columns.indexOf(column)] ?? undefined, values.get(column)),
            ),
          );

          const score = (row: (string | null)[]) =>
            table.columns.reduce(
              (sum, column, index) =>
                sum +
                (values.has(column) && row[index] != null && sameValue(row[index]!, values.get(column))
                  ? table.controls?.includes(column)
                    ? 10000
                    : element.selectors.some((selector) => selector.name === column)
                      ? 1000
                      : 1
                  : 0),
              0,
            );

          const row = candidates.reduce<(string | null)[] | undefined>(
            (best, row) => (!best || score(row) > score(best) ? row : best),
            undefined,
          );
          if (!row) continue;
          for (const [index, column] of table.columns.entries()) {
            const value = row[index];
            if (value === null) continue;
            if (!previous || changedColumns.length || !values.has(column)) {
              if (!sameValue(values.get(column), value)) dirty.add(column);
              values.set(column, value);
            }
          }
        }
        const derived = derive?.(Object.fromEntries(values));
        for (const [key, value] of Object.entries(derived ?? {})) if (!changed.includes(key)) values.set(key, value);
        const connectorIndex = values.get('$connectors');
        if (connectorIndex !== undefined) connectors = connectorSets?.[Number(connectorIndex)] ?? connectors;
        connectors = connectors.map((connector) => ({
          ...connector,
          ...(values.has('$connectionType') ? { connectionType: values.get('$connectionType') } : {}),
          ...(values.has('$technology') ? { technology: values.get('$technology') } : {}),
        }));
        for (const key of [...values.keys()]) if (key.startsWith('$')) values.delete(key);
        const result = rules && xml ? resolveXml(xml, rules, values, changed, !previous, [...dirty]) : values;
        if (rules && xml) {
          for (const [name, choices] of xmlOptions(xml, rules, result)) options.set(name, choices);
          connectors = xmlConnectors(rules, result);
        }

        const resolved = { values: result, connectors, options };
        if (!previous)
          initial = { values: new Map(result), connectors: structuredClone(connectors), options: new Map(options) };

        return resolved;
      };

      return {
        ...element,
        ...(rules
          ? { entry: rules.entry, error: undefined }
          : element.error
            ? { error: `No registered geometry function for ${element.symbol} in the bundled ${name} source.` }
            : {}),
        ...(element.error && rules
          ? {
              defaults: Object.fromEntries(resolve().values),
              selectors: [...resolve().options].map(([name]) => ({ name, label: name })),
            }
          : {}),
        resolve,
        controls: [...new Set([...(element.controls ?? []), ...tables.flatMap((table) => table.controls ?? [])])],
        // Listing FLM elements does not expand size combinations. Build them only
        // for an opened function, and reuse the result while switching its sizes.
        get variants() {
          return (variants ??= element.error
            ? rules
              ? [{ selection: {}, defaults: Object.fromEntries(resolve().values), connectors: resolve().connectors }]
              : []
            : tableValues(tables).map((row) => {
                const { $connectors, $connectionType, $technology, ...parameters } = row;
                const defaults = Object.fromEntries(
                  Object.entries(parameters).filter((entry): entry is [string, string] => entry[1] !== null),
                );
                const values = { ...element.defaults, ...defaults };
                Object.assign(defaults, derive?.(values));
                const connectors =
                  $connectors != null && connectorSets ? connectorSets[Number($connectors)] : element.connectors;
                const connection = {
                  ...($connectionType != null ? { connectionType: $connectionType } : {}),
                  ...($technology != null ? { technology: $technology } : {}),
                };

                return {
                  selection: Object.fromEntries(
                    element.selectors.flatMap(({ name }) => (name in values ? [[name, values[name]]] : [])),
                  ),
                  defaults,
                  ...($connectionType != null || $technology != null
                    ? { connectors: connectors.map((connector) => ({ ...connector, ...connection })) }
                    : $connectors != null && connectorSets
                      ? { connectors }
                      : {}),
                };
              }));
        },
      };
    }),
  };
}

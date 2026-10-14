import type { ConnectorDefinition } from '@engine/geometry';
import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';

export interface XmlRule {
  when?: [string, number, string | string[]][];
  table?: string;
  columns?: [number, string, number][];
  limits?: [string, number, string, boolean][];
}

export interface XmlElement {
  entry: string;
  rules: XmlRule[];
  links: { when: NonNullable<XmlRule['when']>; definition: ConnectorDefinition; gender: string }[];
}

export interface XmlCatalog {
  tables: Record<string, string[][]>;
  elements: Record<string, XmlElement>;
}

export function sameValue(a: string | undefined, b: string | undefined): boolean {
  const normalize = (value: string | undefined) => {
    if (value === 'true') return '1';
    if (value === 'false') return '0';

    return value?.trim() && Number.isFinite(Number(value)) ? String(Number(value)) : value;
  };

  return normalize(a) === normalize(b);
}

function number(expression: string, values: ReadonlyMap<string, string>): string | undefined {
  try {
    return String(evaluateLibraryExpression(expression, values));
  } catch {
    // A conditional dependency can be absent until its input table is resolved.
    return undefined;
  }
}

function active(conditions: XmlRule['when'], values: ReadonlyMap<string, string>): boolean {
  return (conditions ?? []).every(([name, relation, expected]) => {
    const actual = values.get(name) ?? number(name, values);
    if (actual === undefined) return false;
    if (Array.isArray(expected)) return expected.some((value) => sameValue(actual, value));
    switch (relation) {
      case 1:
        return Number(actual) < Number(expected);
      case 2:
        return Number(actual) > Number(expected);
      case 3:
        return sameValue(actual, expected);
      case 4:
        return !sameValue(actual, expected);
      case 5:
        return Number(actual) <= Number(expected);
      case 6:
        return Number(actual) >= Number(expected);
      default:
        return true;
    }
  });
}

const identifiers = (expression: string) => expression.match(/[A-Za-z_][\w.]*/g) ?? [];

// Resolve only the requested row of each shared table. No joins or product of sizes.
export function resolveXml(
  catalog: XmlCatalog,
  element: XmlElement,
  seed: ReadonlyMap<string, string>,
  changed: readonly string[] = [],
  initialize = false,
  derivedChanges: readonly string[] = [],
): Map<string, string> {
  const values = new Map(seed);
  const anchors = new Set(changed.length || initialize ? changed : seed.keys());
  const dirty = new Set(initialize ? seed.keys() : [...changed, ...derivedChanges]);
  const seen = new Map<XmlRule, string>();

  const assign = (name: string, value: string | undefined) => {
    if (value === undefined || anchors.has(name) || sameValue(values.get(name), value)) return;
    values.set(name, value);
    dirty.add(name);
  };

  for (let pass = 0; pass < element.rules.length + 1; ++pass) {
    const before = JSON.stringify([...values]);
    for (const rule of element.rules) {
      if (!active(rule.when, values)) continue;
      const conditionChanged = rule.when?.some(([name]) => identifiers(name).some((key) => dirty.has(key)));
      if (rule.table && rule.columns) {
        const table = catalog.tables[rule.table];
        if (!table?.length) continue;
        const columns = rule.columns;
        const relevant = columns.filter(
          ([, name, type]) => dirty.has(name) && ([0, 1, 6, 8].includes(type) || changed.includes(name)),
        );
        const reverse = columns.some(([, name, type]) => changed.includes(name) && [2, 5, 10].includes(type));
        const signature = JSON.stringify(columns.map(([, name]) => values.get(name)));
        if (seen.get(rule) === signature) continue;
        const rows = table[0]
          .map((_, index) => index)
          .filter((row) =>
            columns.every(([column, name, type]) => {
              const value = values.get(name) ?? number(name, values);
              if (type === 6) return value === undefined || sameValue(table[column]?.[row], value);

              return (
                !anchors.has(name) || (type === 8 && !changed.includes(name)) || sameValue(table[column]?.[row], value)
              );
            }),
          );
        // Manual dimensions outside a lookup table must not be rounded to a preset.
        if (!rows.length) continue;

        const score = (row: number) =>
          columns.reduce(
            (total, [column, name, type]) =>
              total +
              (values.has(name) &&
              table[column]?.[row] !== undefined &&
              sameValue(table[column]?.[row], values.get(name))
                ? changed.includes(name)
                  ? 10000
                  : [0, 1, 8].includes(type)
                    ? dirty.has(name)
                      ? 1000
                      : 100
                    : 1
                : type === 8 && values.has(name)
                  ? -Math.abs(Number(table[column]?.[row]) - Number(values.get(name)))
                  : 0),
            0,
          );

        const row = rows.reduce((best, row) => (score(row) > score(best) ? row : best), rows[0]);
        const changedInputs = relevant.filter(([, , type]) => [0, 1, 6, 8].includes(type));
        if (
          changedInputs.some(([column, name, type]) => type !== 8 && !sameValue(table[column]?.[row], values.get(name)))
        )
          continue;
        for (const [column, name, type] of columns) {
          if (!/^[A-Za-z_]\w*$/.test(name) || type === 6 || (type === 8 && values.has(name) && !reverse)) continue;
          if (!values.has(name) || conditionChanged || relevant.length) assign(name, table[column]?.[row]);
        }
        seen.set(rule, JSON.stringify(columns.map(([, name]) => values.get(name))));
      }
      for (const [name, relation, expression, formula] of rule.limits ?? []) {
        const result = formula ? number(expression, values) : expression;
        if (result === undefined) continue;
        const dependent = formula && identifiers(expression).some((key) => dirty.has(key));
        if (!values.has(name) || ((relation === 0 || relation === 3) && (dependent || conditionChanged))) {
          assign(name, result);
        } else if (relation === 1 && Number(values.get(name)) < Number(result)) {
          assign(name, result);
        } else if (relation === 2 && Number(values.get(name)) > Number(result)) {
          assign(name, result);
        }
      }
    }
    if (before === JSON.stringify([...values])) break;
  }

  return values;
}

export function xmlOptions(
  catalog: XmlCatalog,
  element: XmlElement,
  values: ReadonlyMap<string, string>,
): Map<string, string[]> {
  const options = new Map<string, Set<string>>();

  const add = (name: string, value: string | undefined) => {
    if (value === undefined || !/^[A-Za-z_]\w*$/.test(name)) return;
    if (!options.has(name)) options.set(name, new Set());
    options.get(name)!.add(value);
  };

  for (const rule of element.rules) {
    if (!active(rule.when, values)) continue;
    if (rule.table && rule.columns) {
      const table = catalog.tables[rule.table];
      for (let row = 0; row < (table?.[0]?.length ?? 0); row++) {
        if (
          !rule.columns.every(([column, name, type]) => type !== 6 || sameValue(table[column][row], values.get(name)))
        )
          continue;
        for (const [column, name] of rule.columns) add(name, table[column]?.[row]);
      }
    }
    for (const [name, relation, expression, formula] of rule.limits ?? []) {
      if (relation === 0 || relation === 3) add(name, formula ? number(expression, values) : expression);
    }
  }

  return new Map([...options].map(([name, values]) => [name, [...values]]));
}

export function xmlConnectors(element: XmlElement, values: ReadonlyMap<string, string>): ConnectorDefinition[] {
  const resolve = (text: string) => {
    if (!text.startsWith('%')) return text;
    const name = text.slice(1);
    if (values.has(name)) return values.get(name)!;

    // Some XML revisions use the unnumbered reference for a single numbered
    // connection (e.g. conn_idx / conn1_idx). Never guess between multiple ports.
    const canonical = (key: string) => key.replace(/\d+/g, '').replace(/^conn?_/, 'conn_');

    const aliases = [...values].filter(([key]) => canonical(key) === canonical(name));

    return aliases.length === 1 ? aliases[0][1] : text;
  };

  return element.links
    .filter((link) => active(link.when, values) && Number(number(link.definition.diameter, values)) !== 0)
    .map(({ definition }, index) => {
      const technology = resolve(definition.technology ?? '');

      return {
        ...definition,
        id: index + 1,
        pointName: `linkPoint${index + 1}`,
        technology,
        connectionType: resolve(definition.connectionType ?? ''),
      };
    });
}

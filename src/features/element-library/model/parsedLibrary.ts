import type { ConnectorDefinition } from '@engine/geometry';

// This is a JSON reader, not an XML parser. Keep source codes and unknown fields
// intact; interpreting restrictions belongs to the constraint compiler.
export type FlmValue = string | number | boolean | null | { _enAbsent: true };
export interface FlmNode {
  tag: string;
  attributes: Record<string, string>;
  text: string | null;
  children: FlmNode[];
}
export interface FlmVariable {
  id: string;
  key?: string;
  valueTypeCode: number;
  variableTypeCode?: number;
  visible?: boolean | null;
  labels?: { EN?: string };
  defaultValues: FlmValue[];
  options: { value: FlmValue; labels?: { EN?: string } }[];
  properties: Record<string, FlmValue>;
}

export function isHiddenVariable(variable: FlmVariable): boolean {
  // Explicit display metadata takes precedence over the legacy hidden variable code.
  return variable.visible === false || (variable.visible !== true && variable.variableTypeCode === 7);
}

export interface FlmBinding {
  variable: string;
  columnKey: number;
  levelCode: number;
  bindingTypeCode: number;
  otherAttributes?: Record<string, unknown>;
  unknownXml?: FlmNode[];
}
export interface FlmRestriction {
  index: number;
  typeCode: number;
  argumentCategory?: number;
  tableGuid?: string | null;
  conditionsRaw: Record<string, string | number>;
  bindings: FlmBinding[];
  extraFields: FlmNode[];
}
export interface FlmConnector {
  id: string;
  attributes: Record<string, string | number>;
  positionExpressions?: Record<string, string> | null;
  diameterExpression?: string | null;
  technologyExpression?: string | null;
  connectionTypeExpression?: string | null;
  technologyRef?: { id: string; guid: string; source: string };
  conditionsRaw: Record<string, string | number>;
  fields: Record<string, unknown>;
  variables?: FlmVariable[];
  restrictions?: FlmRestriction[];
  // Preview metadata retained when migrating previously converted libraries.
  // It is not an XML type code or a source of parameter values.
  previewDefinition?: ConnectorDefinition;
}
export interface FlmEntity {
  id: string;
  guid: string;
  xmlEntityId?: string;
  names?: Record<string, { EN?: string }>;
  variables: FlmVariable[];
  restrictions: FlmRestriction[];
  connectors: FlmConnector[];
  geometry?: FlmNode | null;
  paths?: { NAME: string; value: string }[];
  initialValuesRaw?: FlmNode;
  subElements?: (FlmEntity & { unknownXml?: FlmNode[]; definitionRaw?: FlmNode })[];
  aliases?: Record<string, string>;
}
export interface FlmTable {
  guid: string;
  id: string;
  columns: string[];
  arrayAttributes: { COLS: number };
  dataColumns: [['plain', FlmValue[]] | ['dict', FlmValue[], number[]], { typeCode: number }][];
}
export interface FlmTechnology {
  id: string;
  guid: string;
  names: Record<string, { EN?: string }>;
  sizeTableName?: string;
  tableRefs: string[];
  connectionCodes: string[];
  properties: Record<string, FlmValue>;
}
export interface ParsedLibraryJSON {
  schemaVersion: string;
  library: { producer?: { name?: string } };
  entities: Record<string, FlmEntity>;
  specifications: Record<string, FlmTable>;
  technologies: Record<string, FlmTechnology>;
  folders: {
    guid: string;
    names: Record<string, { EN?: string }>;
    entries: { guid: string }[];
  }[];
  diagnostics?: { warnings?: string[] };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function readParsedLibrary(input: unknown): ParsedLibraryJSON {
  if (!record(input)) throw new Error('Invalid FLM JSON document');
  let library: unknown = input;
  if (input.format !== undefined) {
    if (input.format !== 'FLM-PACK-1' || !['2.0', '2.1'].includes(String(input.schemaVersion)))
      throw new Error(`Unsupported FLM JSON format/version: ${input.format}/${input.schemaVersion}`);
    const strings = input.strings;
    const layouts = input.recordLayouts;
    if (!Array.isArray(strings) || strings.some((s) => typeof s !== 'string') || !Array.isArray(layouts))
      throw new Error('Invalid FLM dictionaries');
    for (const keys of layouts)
      if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string') || new Set(keys).size !== keys.length)
        throw new Error('Invalid FLM record layout');

    const at = (array: unknown[], index: unknown): unknown => {
      if (!Number.isInteger(index) || Number(index) < 0 || Number(index) >= array.length)
        throw new Error(`Invalid FLM dictionary reference: ${index}`);

      return array[Number(index)];
    };

    // Memoized properties defer tables/entities until they are actually opened.
    const object = (keys: string[], values: unknown[]): Record<string, unknown> => {
      if (keys.length !== values.length) throw new Error('FLM record length mismatch');
      const result = Object.create(null) as Record<string, unknown>;
      keys.forEach((key, index) => {
        Object.defineProperty(result, key, {
          enumerable: true,
          configurable: true,
          get() {
            const value = decode(values[index]);
            Object.defineProperty(result, key, { enumerable: true, value });

            return value;
          },
        });
      });

      return result;
    };

    const decode = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        if (value[0] === '$') {
          if (value.length !== 2) throw new Error('Invalid FLM string record');

          return at(strings, value[1]);
        }
        if (value[0] === '#') return object(at(layouts, value[1]) as string[], value.slice(2));
        if (value[0] === '~' && input.schemaVersion === '2.1') {
          if (value.length !== 2 || !Array.isArray(value[1])) throw new Error('Invalid FLM literal array');

          return value[1].map(decode);
        }

        return value.map(decode);
      }

      return record(value) ? object(Object.keys(value), Object.values(value)) : value;
    };

    library = decode(input.library);
  }
  if (
    !record(library) ||
    library.schemaVersion !== '2.1-columnar-en' ||
    !record(library.entities) ||
    (library.specifications !== undefined && !record(library.specifications)) ||
    (library.technologies !== undefined && !record(library.technologies)) ||
    (library.folders !== undefined && !Array.isArray(library.folders))
  )
    throw new Error('Unsupported or incomplete ParsedLibraryJSON schema');
  const ids = new Set<string>();
  const normalized = Object.create(null, Object.getOwnPropertyDescriptors(library)) as Record<string, unknown>;
  for (const [name, value] of Object.entries({ specifications: {}, technologies: {}, folders: [] }))
    if (library[name] === undefined) Object.defineProperty(normalized, name, { enumerable: true, value });
  const entities: Record<string, FlmEntity> = Object.create(null);
  for (const [key, entity] of Object.entries(library.entities) as [string, FlmEntity][]) {
    if (
      !entity.guid ||
      ids.has(entity.guid) ||
      !Array.isArray(entity.variables) ||
      (entity.restrictions !== undefined && !Array.isArray(entity.restrictions))
    )
      throw new Error(`Invalid or duplicate FLM entity: ${entity.guid}`);
    ids.add(entity.guid);
    entities[key] = entity;
    if (entity.restrictions === undefined) {
      entities[key] = Object.create(null, Object.getOwnPropertyDescriptors(entity)) as FlmEntity;
      Object.defineProperty(entities[key], 'restrictions', { enumerable: true, value: [] });
    }
  }
  Object.defineProperty(normalized, 'entities', { enumerable: true, value: entities });

  return normalized as unknown as ParsedLibraryJSON;
}

export function flmText(value: FlmValue | undefined): string | undefined {
  return value === null || value === undefined || typeof value === 'object' ? undefined : String(value);
}

export class SpecificationIndex {
  readonly table: FlmTable;
  readonly columns: (string | undefined)[][];
  readonly rows: number[];
  readonly #indexes = new Map<number, Map<string, Set<number>>>();

  constructor(table: FlmTable) {
    this.table = table;
    const count = table.arrayAttributes?.COLS;
    if (!Number.isInteger(count) || count < 0 || table.columns.length !== table.dataColumns?.length)
      throw new Error(`Invalid specification dimensions: ${table.guid}`);
    this.rows = Array.from({ length: count }, (_, i) => i);
    this.columns = table.dataColumns.map(([storage]) => {
      if (!['plain', 'dict'].includes(storage[0])) throw new Error(`Unknown column storage: ${table.guid}`);
      const values =
        storage[0] === 'plain'
          ? storage[1]
          : storage[2].map((index) => {
              if (!Number.isInteger(index) || index < 0 || index >= storage[1].length)
                throw new Error(`Invalid VALUE_MAP: ${table.guid}`);

              return storage[1][index];
            });
      if (values.length !== count) throw new Error(`Specification row count mismatch: ${table.guid}`);

      return values.map(flmText);
    });
  }

  matching(column: number, value: string): ReadonlySet<number> {
    if (!this.columns[column]) throw new Error(`Missing column ${column}: ${this.table.guid}`);
    let index = this.#indexes.get(column);
    if (!index) {
      index = new Map();
      this.columns[column].forEach((cell, row) => {
        if (cell === undefined) return;
        const key = this.#key(cell);
        const rows = index!.get(key) ?? new Set();
        rows.add(row);
        index!.set(key, rows);
      });
      this.#indexes.set(column, index);
    }

    return index.get(this.#key(value)) ?? new Set();
  }

  #key(value: string): string {
    return value.trim() && Number.isFinite(Number(value)) ? String(Number(value)) : value;
  }
}

import catalogue from '@/features/element-library/data/technologies.json';
import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import type { ConnectorDefinition, PipeConnection } from '@engine/geometry';
import type { XmlCatalog, XmlRule } from '@/features/element-library/model/xmlRules';

// Each XML size row is shared: nominal, internal, external male/female, flange diameter/thickness.
const technologies = new Map(
  Object.entries(catalogue.technologies).flatMap(([id, technology]) =>
    [id, ...technology.aliases].map((name) => [name, technology] as const),
  ),
);

// Carry the actual XML row selection into the Link, including type-8 lookups
// whose input is formula-derived and need not equal the table's nominal size.
export function applyPipeSizeLookups(
  definitions: readonly ConnectorDefinition[],
  values: ReadonlyMap<string, string>,
  catalog: XmlCatalog,
  selectedRows: ReadonlyMap<XmlRule, number>,
): void {
  for (const definition of definitions) {
    const technology = technologies.get(definition.technology ?? '');
    if (!definition.physical || !technology) continue;
    for (const [rule, row] of selectedRows) {
      if (rule.table !== technology.table) continue;
      const input = rule.columns?.find(([column, name]) => column === 0 && name === definition.diameter);
      if (!input) continue;
      const diameter = Number(values.get(input[1]));
      const nominal = Number(catalog.tables[rule.table][0][row]);
      if (Number.isFinite(diameter) && Number.isFinite(nominal))
        definition.physical = {
          ...definition.physical,
          sizeLookup: { technology: definition.technology!, diameter, nominal },
        };
    }
  }
}

export function resolvePipeConnections(
  definitions: readonly ConnectorDefinition[],
  values: ReadonlyMap<string, string>,
): PipeConnection[] {
  return definitions.flatMap((definition): PipeConnection[] => {
    if (!definition.physical || definition.type !== 'Circular') return [];
    const technology = technologies.get(definition.technology ?? '');
    if (!technology) return [];
    try {
      const nominal = evaluateLibraryExpression(definition.diameter, values);
      const lookup = definition.physical.sizeLookup;
      const sizeNominal =
        lookup && lookup.technology === definition.technology && lookup.diameter === nominal ? lookup.nominal : nominal;
      const size = catalogue.sizes[technology.sizes].find((row) => Math.abs(row[0] - sizeNominal) < 1e-8);
      // Never replace an out-of-table manual diameter with an unrelated nominal size.
      if (!size) return [];
      const female = ['F', '14'].includes(definition.connectionType?.trim().toUpperCase() ?? '');
      const type =
        technology.representation === 1
          ? 'flanged'
          : technology.representation === 2
            ? female
              ? 'female'
              : 'male'
            : 'neutral';
      let length = 0;
      try {
        length = evaluateLibraryExpression(definition.physical.length, values);
      } catch {
        // No resolved FLENGTH: do not invent an axial extension. Flange sizes
        // can still be resolved independently and use the zero-length profile.
      }
      if (!Number.isFinite(length)) return [];

      return [
        {
          definition,
          type,
          length,
          internalDiameter: size[1],
          externalDiameter: size[type === 'female' ? 3 : 2],
          flangeSize: type === 'flanged' ? size[4] : 0,
          flangeThickness: type === 'flanged' ? size[5] : 0,
        },
      ];
    } catch {
      // Inactive/incomplete XML inputs do not borrow dimensions from another Link.
      return [];
    }
  });
}

export function pipeConnectionParameters(
  connections: readonly PipeConnection[],
  definitions: readonly ConnectorDefinition[] = [],
): Map<string, string> {
  const parameters = new Map<string, string>();
  // Clear obsolete dimensions when a technology/diameter is no longer resolved.
  for (const definition of definitions.filter((definition) => definition.physical))
    for (const query of ['get_ext_diam', 'get_fln_size', 'get_fln_diam', 'get_fln_thick', 'get_ldist'])
      parameters.set(`${definition.name}:${query}`, '0');
  for (const connection of connections)
    for (const [query, value] of Object.entries({
      get_ext_diam: connection.externalDiameter,
      // Legacy get_fln_size is the axial allowance used by the flanged fittings.
      // get_fln_diam supplies the flange diameter; get_fln_thick is the explicit thickness query.
      get_fln_size: connection.flangeThickness,
      get_fln_diam: connection.flangeSize,
      get_fln_thick: connection.flangeThickness,
      get_ldist: connection.length,
    }))
      parameters.set(`${connection.definition.name}:${query}`, String(value));

  return parameters;
}

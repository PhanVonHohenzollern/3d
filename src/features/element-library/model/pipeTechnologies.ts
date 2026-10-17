import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import type { ConnectorDefinition, PipeConnection } from '@engine/geometry';

export function resolvePipeConnections(
  definitions: readonly ConnectorDefinition[],
  values: ReadonlyMap<string, string>,
): PipeConnection[] {
  return definitions.flatMap((definition): PipeConnection[] => {
    if (!definition.physical || definition.type !== 'Circular') return [];
    const snapshot = definition.physical.resolvedSize;
    if (!snapshot || snapshot.technology !== definition.technology) return [];
    try {
      const nominal = evaluateLibraryExpression(definition.diameter, values);
      if (snapshot.diameter !== nominal) return [];
      const size = [snapshot.diameter, snapshot.internalDiameter, snapshot.externalMale, snapshot.externalFemale, snapshot.flangeDiameter, snapshot.flangeThickness];
      const female = ['F', '14'].includes(definition.connectionType?.trim().toUpperCase() ?? '');
      const type =
        snapshot.representation === 1
          ? 'flanged'
          : snapshot.representation === 2
            ? female
              ? 'female'
              : 'male'
            : 'neutral';
      const length = evaluateLibraryExpression(definition.physical.length, values);
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

/**
 * Only flanged and threaded technologies contribute an additional Connector
 * Geometry Mesh. The TECHNOLOGY ID comes from the resolved XML/JSON graph:
 *   FLN_* (flanged, representation=1)
 *   THR_* (threaded, representation=2)
 * Representation alone is NOT a discriminator: socket-welded, glued and copper
 * technologies also use representation=2 and must not generate extra meshes.
 *
 * This filter is preview-only. Do not apply it to resolvePipeConnections() or
 * pipeConnectionParameters(): C++ geometry queries still need every connector.
 * TYPE 13/14 (male/female) is deliberately ignored for preview geometry.
 */
export function connectorMeshConnections(
  connections: readonly PipeConnection[],
): PipeConnection[] {
  return connections.flatMap((connection): PipeConnection[] => {
    const resolved = connection.definition.physical?.resolvedSize;
    const technologyId = resolved?.technology?.trim().toUpperCase();
    if (!resolved || !technologyId || resolved.technology !== connection.definition.technology) return [];

    if (/^(?:FLN|FLANGED)(?:_|$)/.test(technologyId) && resolved.representation === 1) {
      // Keep the flange geometry and its graph-resolved dimensions.
      return [connection];
    }

    if (!/^(?:THR|THREAD|THREADED)(?:_|$)/.test(technologyId) || resolved.representation !== 2)
      return [];

    // Threaded's nominal d is a size designation, not the physical outer
    // diameter; the declared inner diameter can legitimately exceed d.
    // Use one common neutral outer envelope from the resolved Technology table
    // (dm/df), independent of the port's TYPE=13/14 or Female/Male label.
    const outer = Math.max(resolved.externalMale, resolved.externalFemale);
    if (
      !Number.isFinite(outer) ||
      !Number.isFinite(resolved.internalDiameter) ||
      resolved.internalDiameter < 0 ||
      outer <= resolved.internalDiameter
    ) return [];

    return [{
      ...connection,
      type: 'neutral',
      externalDiameter: outer,
      internalDiameter: resolved.internalDiameter,
      flangeSize: 0,
      flangeThickness: 0,
    }];
  });
}

export function pipeConnectionParameters(
  connections: readonly PipeConnection[],
  definitions: readonly ConnectorDefinition[] = [],
): Map<string, string> {
  const parameters = new Map<string, string>();
  // Clear obsolete dimensions when a technology/diameter is no longer resolved.
  for (const definition of definitions.filter((definition) => definition.physical))
    for (const query of ['get_ext_diam', 'get_fln_size', 'get_fln_diam', 'get_fln_thick'])
      parameters.set(`${definition.name}:${query}`, '0');
  for (const connection of connections)
    for (const [query, value] of Object.entries({
      get_ext_diam: connection.externalDiameter,
      // Legacy get_fln_size is the axial allowance used by the flanged fittings.
      // get_fln_diam supplies the flange diameter; get_fln_thick is the explicit thickness query.
      get_fln_size: connection.flangeThickness,
      get_fln_diam: connection.flangeSize,
      get_fln_thick: connection.flangeThickness,
    }))
      parameters.set(`${connection.definition.name}:${query}`, String(value));

  return parameters;
}

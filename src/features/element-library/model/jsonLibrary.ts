import { defaultConnectorDefinition, type ConnectorDefinition } from '@engine/geometry';
import {
  CompiledConstraintGraph,
  UnifiedConstraintSolver,
  expressionValue,
  restrictionActive,
  type ResolvedSnapshot,
} from '@/features/element-library/model/constraintGraph';
import { isHiddenVariable, readParsedLibrary, type FlmConnector } from '@/features/element-library/model/parsedLibrary';
import { pipeConnectionParameters, resolvePipeConnections } from '@/features/element-library/model/pipeTechnologies';
import type { ElementLibrary, LibraryElement, LibraryValues } from '@/features/element-library/model/types';

// Renderer-only convention: a short connector tube is half its outside diameter.
// This does not originate from XML FLENGTH and is never exported as get_ldist.
export const PREVIEW_CONNECTOR_TUBE_LENGTH_RATIO = 0.5;

const directions: Record<number, ConnectorDefinition['orientation']> = {
  1: 'XNegative',
  2: 'XPositive',
  3: 'YPositive',
  4: 'YNegative',
  5: 'ZPositive',
  6: 'ZNegative',
};

function connectorDefinition(
  link: FlmConnector,
  index: number,
  graph: CompiledConstraintGraph,
  snapshot: ResolvedSnapshot,
  connectorDiagnostics: string[],
): ConnectorDefinition | undefined {
  const prepared = link.previewDefinition;
  const values = graph.context(
    snapshot.resolvedValues,
    link.variables?.length || link.restrictions?.length ? `connector:${link.id}/` : '',
  );

  // Link visualization is optional; its failure is not a failure of the
  // independent JSON constraint graph. Do not create partial/invalid link mesh.
  const issue = (message: string) => {
    connectorDiagnostics.push(`${link.id}: ${message}`);
  };

  const active = restrictionActive(link.conditionsRaw, values);
  if (active === undefined) issue('unresolved activation condition');
  if (active !== true) return;

  const reference = (expression: string | null | undefined) =>
    expression?.startsWith('%') ? values.get(expression.slice(1)) : (expression ?? undefined);

  const technologyId = link.technologyExpression?.startsWith('%')
    ? reference(link.technologyExpression)
    : (link.technologyRef?.id ?? reference(link.technologyExpression));
  const connectionType = reference(link.connectionTypeExpression) ?? String(link.attributes.TYPE);
  const sourceType = Number(link.attributes.TYPE);
  const rectangular = sourceType === 1 || sourceType === 2 || prepared?.type === 'Rectangular';
  const orientation = prepared?.orientation ?? directions[Number(link.fields.DIR)];
  if (!orientation) {
    issue(`unsupported direction ${link.fields.DIR}`);

    return;
  }
  if (!prepared && ![1, 2, 3, 4, 12, 13, 14, 15].includes(sourceType)) {
    issue(`unsupported connector type ${link.attributes.TYPE}`);

    return;
  }
  if (
    !prepared &&
    (rectangular ? link.fields.FHEIGHT === undefined || link.fields.FWIDTH === undefined : !link.diameterExpression)
  ) {
    issue('missing position or profile dimensions');

    return;
  }
  const angles = (link.fields.ANGLE as { attributes?: Record<string, string> } | undefined)?.attributes ?? {};
  const definition: ConnectorDefinition = {
    ...defaultConnectorDefinition(),
    // Source XML/JSON is authoritative. Preview metadata is only a fallback.
    ...structuredClone(prepared),
    id: index + 1,
    name: link.id,
    pointName: `linkPoint${index + 1}`,
    type: rectangular ? 'Rectangular' : 'Circular',
    orientation,
    diameter: link.diameterExpression ?? '0',
    technology: technologyId,
    connectionType,
    // An omitted POSITION denotes the element origin, just as omitted axes
    // within a POSITION denote zero. It does not mean the port is absent.
    position: ['X', 'Y', 'Z'].map((axis) => link.positionExpressions?.[axis] ?? '0') as [string, string, string],
    angles: [angles.Gamma ?? '0', angles.Beta ?? '0', angles.Alpha ?? '0'],
    aSize: String(link.fields.FWIDTH ?? prepared?.aSize ?? '0'),
    bSize: String(link.fields.FHEIGHT ?? prepared?.bSize ?? '0'),
    // The engine's ConnectorDefinition requires physical.length.
    // It is filled with a preview-only dimension after the size lookup.
    physical: { length: '' },
  };
  definition.technology = technologyId;
  definition.connectionType = connectionType;
  // Rectangular and symbolic links still use the same resolved variables, but
  // have no piping size table. Preserve their source-defined preview properties.
  const expressions = [
    ...definition.position,
    ...definition.angles,
    ...(definition.type === 'Circular' ? [definition.diameter] : [definition.aSize, definition.bSize]),
  ];
  const context = values;
  for (const expression of expressions)
    if (
      expressionValue(expression, context) === undefined ||
      !Number.isFinite(Number(expressionValue(expression, context)))
    ) {
      issue(`cannot resolve ${expression}`);

      return;
    }
  // Materialize every profile in the connector's own graph scope.
  definition.position = definition.position.map((expression) => expressionValue(expression, values) ?? expression) as [
    string,
    string,
    string,
  ];
  definition.angles = definition.angles.map((expression) => expressionValue(expression, values) ?? expression) as [
    string,
    string,
    string,
  ];
  if (definition.type === 'Rectangular') {
    definition.aSize = expressionValue(definition.aSize, values) ?? definition.aSize;
    definition.bSize = expressionValue(definition.bSize, values) ?? definition.bSize;
    if (Number(definition.aSize) <= 0 || Number(definition.bSize) <= 0) {
      issue('invalid rectangular dimensions');

      return;
    }
    delete definition.physical;

    return definition;
  }
  const diameter = Number(expressionValue(definition.diameter, context));
  if (diameter === 0) return;
  if (!Number.isFinite(diameter) || diameter < 0) {
    issue('invalid diameter');

    return;
  }
  // Always materialize connector expressions from the same snapshot used by
  // geometry; root and connector-local expressions follow one rule.
  definition.diameter = String(diameter);

  const withoutPhysicalSize = (message: string): ConnectorDefinition => {
    issue(message);
    delete definition.physical;

    return definition;
  };

  if (!link.technologyExpression && !link.technologyRef) {
    delete definition.physical;

    return definition;
  }
  const technology = technologyId ? graph.library.technologies[technologyId] : undefined;
  if (!technology) {
    return withoutPhysicalSize(
      `missing technology ${technologyId ?? link.technologyExpression}; Link profile retained`,
    );
  }
  // Only tables referenced by this technology are consulted. IDs from another
  // library never override the same technology ID in this resolved snapshot.
  const sizes = technology.tableRefs
    .map((guid) => graph.library.specifications[guid])
    .filter((t) => t?.id === technology.sizeTableName);
  if (sizes.length !== 1) {
    return withoutPhysicalSize(`ambiguous or missing size table ${technology.sizeTableName}; Link profile retained`);
  }
  const table = graph.table(sizes[0].guid);
  const representation = Number(technology.properties.REPRESENTATION);
  const columns = table.table.columns;
  // Read the size schema supplied by the referenced Technology, not a
  // hard-coded assumption that every Pipe table uses the same column names.
  const nominalColumn = ['d', 'Dn_nom', 'dn_out'].map((name) => columns.indexOf(name)).find((index) => index >= 0);
  if (nominalColumn === undefined || ![0, 1, 2].includes(representation)) {
    return withoutPhysicalSize(`unsupported technology size schema (${columns.join(', ')}); Link profile retained`);
  }
  const candidates = [...table.matching(nominalColumn, String(diameter))];
  const row = candidates[0];
  if (row === undefined) {
    return withoutPhysicalSize(`no technology size for diameter ${diameter}; Link profile retained`);
  }
  if (candidates.some((candidate) => table.columns.some((column) => column[candidate] !== column[row]))) {
    return withoutPhysicalSize(`ambiguous technology size for diameter ${diameter}; Link profile retained`);
  }

  const size = (name: string): number | undefined => {
    const index = columns.indexOf(name);
    const value = index < 0 ? undefined : table.columns[index][row];

    return value !== undefined && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
  };

  // PP-R tables have pressure-specific inner diameters. The pressure class is
  // the actual graph value (e.g. pn_10), never an assumed default column.
  const pressure = values.get('pn');
  const pressureCode = pressure?.match(/^pn_?(\d+)$/i)?.[1];
  const internal = size('dint') ?? size('Dn_in') ?? (pressureCode ? size(`dn_in_${pressureCode}`) : undefined);
  const male = representation === 2 ? size('dm') : (size('dext') ?? size('Dn_out') ?? size('dn_out'));
  const female = representation === 2 ? size('df') : male;
  const flange = representation === 1 ? size('df') : 0;
  const thick = representation === 1 ? size('ft') : 0;
  if ([internal, male, female, flange, thick].some((n) => n === undefined)) {
    return withoutPhysicalSize(`missing connection dimensions (${columns.join(', ')}); Link profile retained`);
  }
  // This length is used ONLY for the temporary cyan tube shown by the preview.
  // It is not an XML restriction, an element parameter, or physical connection data.
  definition.physical!.length = String(Math.max(diameter, male!, female!) * PREVIEW_CONNECTOR_TUBE_LENGTH_RATIO);
  definition.physical!.resolvedSize = {
    technology: technologyId!,
    diameter,
    representation,
    internalDiameter: internal!,
    externalMale: male!,
    externalFemale: female!,
    flangeDiameter: flange!,
    flangeThickness: thick!,
  };

  return definition;
}

export function createJsonLibrary(
  name: string,
  input: unknown,
  entries: Record<string, { entry: string; error?: string }>,
): ElementLibrary {
  const library = readParsedLibrary(input);

  return {
    name,
    elements: Object.values(library.entities).map((entity): LibraryElement => {
      const registered = entries[entity.guid] ?? { entry: '', error: `No geometry mapping: ${entity.id}` };
      let graph: CompiledConstraintGraph | undefined,
        solver: UnifiedConstraintSolver | undefined,
        initial: LibraryValues | undefined;
      let unboundDiscovered: string[] = [];

      const resolve: NonNullable<LibraryElement['resolve']> = (previous, changed = []) => {
        if (!previous && initial) return structuredClone(initial);
        graph ??= new CompiledConstraintGraph(library, entity);
        solver ??= new UnifiedConstraintSolver(graph);
        // Do not re-import old runtime overrides, connector sizes or legacy defaults
        // as graph inputs. Only declared graph variables/dependencies can be pinned.
        const graphInputs = new Map<string, string>();
        for (const [key, value] of previous ?? [])
          if (graph.variables.has(key) || graph.edges.has(key)) graphInputs.set(key, value);
        const graphChanges = changed.filter((key) => graph!.variables.has(key) || graph!.edges.has(key));
        const snapshot = solver.solve(graphInputs, graphChanges);
        const connectorDiagnostics: string[] = [];
        const parameterDiagnostics = unboundDiscovered.map(
          (name) => `get_val("${name}") has no JSON variable in ${entity.id}; validate if its C++ branch executes`,
        );
        parameterDiagnostics.push(...(snapshot.deferredExpressions ?? []).map((issue) => issue.message));
        // Static discovery visits inactive branches as well. The runtime checks
        // executed get_val requests against this snapshot before publishing.
        // A declared optional variable is no more mandatory than an undeclared
        // one until its branch runs; empty strings are valid text values.
        // A conflict must never produce partially resolved connectors or sizes.
        const candidates =
          snapshot.status === 'valid'
            ? (entity.connectors ?? []).flatMap(
                (link, index) => connectorDefinition(link, index, graph!, snapshot, connectorDiagnostics) ?? [],
              )
            : [];
        const connectors = snapshot.status === 'valid' ? candidates : [];
        if (snapshot.status === 'valid')
          for (const [key, value] of pipeConnectionParameters(
            resolvePipeConnections(connectors, snapshot.resolvedValues),
            connectors,
          ))
            snapshot.resolvedValues.set(key, value);
        const result: LibraryValues = {
          values: snapshot.resolvedValues,
          connectors,
          options: snapshot.validOptions,
          snapshot,
          connectorDiagnostics,
          parameterDiagnostics,
          errors:
            snapshot.status === 'valid'
              ? []
              : snapshot.conflicts.length
                ? snapshot.conflicts.map((c) => c.message)
                : [`Configuration is ${snapshot.status}`],
        };
        if (!previous) initial = structuredClone(result);

        return result;
      };

      return {
        id: entity.guid,
        name: entity.names?.ENT_NAME?.EN || entity.id,
        symbol: entity.names?.ENT_SYMBOL?.EN || entity.id,
        entry: registered.entry,
        error: registered.error,
        requireParameters(names) {
          graph ??= new CompiledConstraintGraph(library, entity);
          const unique = [...new Set(names)];

          // discoverParameters walks all branches of a shared C++ wrapper.
          // A name never declared in this entity cannot safely be required
          // *before* execution: it may only be used by another case. Keep a
          // diagnostic and fail if such a get_val is actually executed.
          const declared = (name: string) => graph!.variables.has(name) || graph!.edges.has(name);

          unboundDiscovered = unique.filter((name) => !declared(name));
          initial = undefined;
        },
        selectors: entity.variables
          .filter((v) => !isHiddenVariable(v))
          .map((v) => ({ name: v.id, label: v.labels?.EN || v.id })),
        hiddenParameters: entity.variables.filter(isHiddenVariable).map((v) => v.id),
        get defaults() {
          return Object.fromEntries(resolve().values);
        },
        connectors: [],
        resolve,
        get variants() {
          const result = resolve();

          return [{ selection: {}, defaults: Object.fromEntries(result.values), connectors: result.connectors }];
        },
      };
    }),
  };
}

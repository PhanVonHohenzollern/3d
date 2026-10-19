import { defaultConnectorDefinition, type ConnectorDefinition } from '@engine/geometry';
import {
  CompiledConstraintGraph,
  UnifiedConstraintSolver,
  expressionValue,
  restrictionActive,
  type ResolvedSnapshot,
} from '@/features/element-library/model/constraintGraph';
import {
  isHiddenVariable,
  readParsedLibrary,
  verifiedSourceConditions,
  type FlmConnector,
} from '@/features/element-library/model/parsedLibrary';
import { resolveLocalTechnology } from '@/features/element-library/model/localTechnology';
import { pipeConnectionParameters, resolvePipeConnections } from '@/features/element-library/model/pipeTechnologies';
import type { ElementLibrary, LibraryElement, LibraryValues } from '@/features/element-library/model/types';

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

  const canonical = verifiedSourceConditions(graph.library, graph.entity, link);
  if (canonical.invalidFields.length) issue(`unverified XML condition aliases: ${canonical.invalidFields.join(', ')}`);
  const active = restrictionActive(canonical.conditions, values);
  if (active === undefined) issue('unresolved activation condition');
  if (active !== true) return;

  const reference = (expression: string | null | undefined) =>
    expression?.startsWith('%') ? values.get(expression.slice(1)) : (expression ?? undefined);

  // A Link without its own DEF_TECHID inherits the element's solved technical
  // identifier. The display label `tech` is not a substitute for tech_idx.
  const expression = link.technologyExpression?.trim();
  const dynamicTechnology = expression?.startsWith('%') || (!!expression && values.has(expression));
  const technologyToken = dynamicTechnology
    ? values.get(expression!.replace(/^%/, ''))
    : expression
      ? (link.technologyRef?.id ?? expression)
      : (link.technologyRef?.id ?? values.get('tech_idx'));
  const locallyResolved = resolveLocalTechnology(graph.library, technologyToken);
  const guidMatches =
    dynamicTechnology ||
    !link.technologyRef ||
    !locallyResolved.technology ||
    locallyResolved.technology.guid.toLowerCase() === link.technologyRef.guid.toLowerCase();
  const technology = guidMatches ? locallyResolved.technology : undefined;
  const technologyId = technology?.id ?? technologyToken;
  const connectionExpression = link.connectionTypeExpression?.trim();
  const connectionType = connectionExpression
    ? (values.get(connectionExpression) ?? reference(connectionExpression) ?? String(link.attributes.TYPE))
    : (values.get('conn_idx') ?? String(link.attributes.TYPE));
  const sourceType = Number(link.attributes.TYPE);
  const rectangular = sourceType === 1 || sourceType === 2 || prepared?.type === 'Rectangular';
  const orientation = directions[Number(link.fields.DIR)] ?? prepared?.orientation;
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
    position: ['X', 'Y', 'Z'].map((axis) => link.positionExpressions?.[axis]?.trim() || '0') as [
      string,
      string,
      string,
    ],
    angles: [angles.Gamma?.trim() || '0', angles.Beta?.trim() || '0', angles.Alpha?.trim() || '0'],
    aSize: String(link.fields.FWIDTH ?? prepared?.aSize ?? '0'),
    bSize: String(link.fields.FHEIGHT ?? prepared?.bSize ?? '0'),
    physical: { length: String(link.fields.FLENGTH ?? '0') },
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
  const evaluated = new Map<string, string | undefined>();

  const evaluate = (expression: string): string | undefined => {
    if (!evaluated.has(expression)) evaluated.set(expression, expressionValue(expression, context));

    return evaluated.get(expression);
  };

  for (const expression of expressions)
    if (evaluate(expression) === undefined || !Number.isFinite(Number(evaluate(expression)))) {
      issue(`cannot resolve ${expression}`);

      return;
    }
  // Materialize every profile in the connector's own graph scope.
  definition.position = definition.position.map((expression) => evaluate(expression) ?? expression) as [
    string,
    string,
    string,
  ];
  definition.angles = definition.angles.map((expression) => evaluate(expression) ?? expression) as [
    string,
    string,
    string,
  ];
  if (definition.type === 'Rectangular') {
    definition.aSize = evaluate(definition.aSize) ?? definition.aSize;
    definition.bSize = evaluate(definition.bSize) ?? definition.bSize;
    if (Number(definition.aSize) <= 0 || Number(definition.bSize) <= 0) {
      issue('invalid rectangular dimensions');

      return;
    }
    delete definition.physical;

    return definition;
  }
  const diameter = Number(evaluate(definition.diameter));
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

  if (!technologyToken) {
    delete definition.physical;

    return definition;
  }
  if (!technology)
    return withoutPhysicalSize(
      `${
        guidMatches
          ? (locallyResolved.issue ?? `missing local technology ${technologyToken}`)
          : `technology GUID differs from this library's definition (${technologyToken})`
      }; Link profile retained`,
    );
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
  // Extra technology mesh is selected from THIS technology definition, not
  // from global FLN_*/THR_* identifier prefixes. Representation=2 is shared
  // by soldered/glued/copper/threaded sources and cannot identify thread alone.
  const sourceName = technology.names?.TECH_NAME?.EN?.trim() ?? '';
  const technologyMeshKind =
    representation === 1
      ? 'flanged'
      : representation === 2 && /\bthread(?:ed|ing)?\b/i.test(sourceName)
        ? 'threaded'
        : 'none';
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
  // Physical connector geometry terminates at the source-defined connection
  // plane and extends inward by FLENGTH. The cyan overlay has its own display
  // length; using a diameter ratio here changes the actual fitting geometry.
  const length = evaluate(definition.physical!.length);
  if (length === undefined || !length.trim() || !Number.isFinite(Number(length)) || Number(length) < 0)
    return withoutPhysicalSize(`cannot resolve connector length ${definition.physical!.length}; Link profile retained`);
  definition.physical!.length = length;
  definition.physical!.resolvedSize = {
    technology: technologyId!,
    diameter,
    representation,
    internalDiameter: internal!,
    externalMale: male!,
    externalFemale: female!,
    flangeDiameter: flange!,
    flangeThickness: thick!,
    libraryGuid: graph.library.library.guid,
    technologyGuid: technology.guid,
    meshKind: technologyMeshKind,
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
      let boundDiscovered: string[] = [];

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
        // Check technology labels against the complete constraint graph,
        // including dependent defaults and conditional size tables.
        if (snapshot.status === 'valid') {
          const numericInputs = boundDiscovered.filter((name) => {
            const value = snapshot.resolvedValues.get(name);

            return graph!.variables.get(name)?.valueTypeCode !== 3 && !!value?.trim() && Number.isFinite(Number(value));
          });
          for (const [name, choices] of snapshot.validOptions) {
            if (!/(?:^|_)tech\d*$/.test(name) || choices.length < 2) continue;
            const accepted = choices.filter((choice) => {
              if (snapshot.resolvedValues.get(name) === choice) return true;
              const candidate = new Map(snapshot.resolvedValues);
              candidate.set(name, choice);

              const solved = solver!.solve(candidate, [name]);

              return (
                solved.status === 'valid' &&
                numericInputs.every((input) => {
                  const value = solved.resolvedValues.get(input);

                  return !!value?.trim() && Number.isFinite(Number(value));
                })
              );
            });
            snapshot.validOptions.set(name, accepted);
          }
        }
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
          boundDiscovered = unique.filter(declared);
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

import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import type { ParameterBindingMode } from '@/entities/parameter';
import { interpolateTable, type NumericLookupInput } from '@/features/element-library/model/tableLookup';
import {
  flmText,
  verifiedSourceConditions,
  SpecificationIndex,
  type FlmBinding,
  type FlmEntity,
  type FlmCompiledGraph,
  type FlmRestriction,
  type FlmVariable,
  type ParsedLibraryJSON,
} from '@/features/element-library/model/parsedLibrary';

export interface ConstraintConflict {
  code: string;
  message: string;
  restriction?: string;
}
export interface ResolvedSnapshot {
  parameterModes?: Map<string, ParameterBindingMode>;
  missingInputs?: string[];
  deferredExpressions?: ConstraintConflict[];
  resolvedValues: Map<string, string>;
  validOptions: Map<string, string[]>;
  // Nonrestrictive table mappings and LIMITs provide suggestions.
  // These are *not* a closed list; user input is validated by Single LIMITs.
  nonrestrictiveParameters: Set<string>;
  activeRestrictions: string[];
  affectedGroups: string[];
  conflicts: ConstraintConflict[];
  status: 'valid' | 'ambiguous' | 'conflict' | 'unresolved';
}
export interface ConstraintFactor {
  id: string;
  rule: FlmRestriction;
  scope: string;
  variables: string[];
}
export interface DependencyGroup {
  id: string;
  variables: string[];
  dependencies: string[];
}

// FLM variable identifiers may contain dots (e.g. BELIMO t.sensors, t.medium).
// Distinguish a plain dotted name from an arithmetic expression.
const identifier = /^[$A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*$/;

// TYPE=1 is nonrestrictive, including LEVEL=0 in a coupled mapping.
// Native Adjust also preserves explicitly edited TYPE=5 defaults (RVA
// 0x4120D0/0x412215 in FluidLib.dll). LEVEL orders dependent defaults.
const isSuggestedBinding = (rule: FlmRestriction, binding: FlmBinding): boolean =>
  [1, 5].includes(binding.bindingTypeCode) && identifier.test(binding.variable) && rule.typeCode === 1;

const inputs = (text: string) =>
  [...text.matchAll(/\b[A-Za-z_][\w.]*(?![\w.]|\s*\()/g)].map((m) => m[0]).filter((v) => v !== 'pi');

// The native mat_idx lookup can assign an opaque technology identifier to a
// hidden *_idx variable even when its legacy VAL_TYPE is numeric. The string
// must be preserved as an identifier, never coerced to NaN or to the row index.
function isSymbolicTechnologyIndex(name: string, variable: FlmVariable | undefined): boolean {
  return !!variable && variable.variableTypeCode === 7 && /(?:^|_)tech_idx$/i.test(name);
}

const same = (a: string | undefined, b: string | undefined) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.trim() !== '' &&
    b.trim() !== '' &&
    Number.isFinite(Number(a)) &&
    Number(a) === Number(b));

export function expressionValue(expression: string, values: ReadonlyMap<string, string>): string | undefined {
  if (values.has(expression)) return values.get(expression);
  // Preserve an explicitly absent optional dimension through derived formulas.
  // Missing variables remain unresolved; an empty value is never coerced to 0.
  if (inputs(expression).some((name) => values.get(name) === '')) return '';
  try {
    return String(evaluateLibraryExpression(expression, values));
  } catch {
    return undefined;
  }
}

// FLM CND_REL: 1 <, 2 <=, 3 ==, 4 !=, 5 >=, 6 >.
// All distinct condition variables are ANDed. Repeated equality conditions on
// the *same* variable express alternatives (e.g. sld_idx == 1 OR sld_idx == 9
// in General/RRAF*), whereas bounds on that variable are intersected.
export function restrictionActive(
  conditions: Record<string, string | number>,
  values: ReadonlyMap<string, string>,
): boolean | undefined {
  // DEF_LINK uses CND_VAR/CND_REL/CND_VAL without a numeric suffix, while
  // restrictions use CND_VAR1/... . Both encode the same condition triple.
  if (Object.keys(conditions).some((key) => /^CND_(VAR|REL|VAL)$/.test(key))) {
    const normalized: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(conditions)) {
      const target = /^CND_(VAR|REL|VAL)$/.test(key) ? `${key}1` : key;
      if (Object.hasOwn(normalized, target) && String(normalized[target]) !== String(value)) return undefined;
      normalized[target] = value;
    }
    conditions = normalized;
  }
  let unknown = Object.keys(conditions).some((key) => !/^CND_(VAR|REL|VAL)\d+$/.test(key));
  const indexes = Object.keys(conditions)
    .filter((key) => /^CND_VAR\d+$/.test(key))
    .map((key) => key.slice(7));
  const visited = new Set<string>();

  for (const index of indexes) {
    if (visited.has(index)) continue;
    const lhs = String(conditions['CND_VAR' + index]);
    const actual = expressionValue(lhs, values);
    const code = Number(conditions['CND_REL' + index]);
    if (actual === undefined || ![1, 2, 3, 4, 5, 6].includes(code)) {
      unknown = true;
      continue;
    }
    let alternatives = [index];
    if (code === 3) {
      alternatives = indexes.filter(
        (other) => String(conditions['CND_VAR' + other]) === lhs && Number(conditions['CND_REL' + other]) === 3,
      );
    }
    alternatives.forEach((other) => visited.add(other));

    const results: boolean[] = [];
    let unresolved = false;
    for (const other of alternatives) {
      const raw = String(conditions['CND_VAL' + other] ?? '');
      const choices = raw.includes(';') ? raw.split(';').filter(Boolean) : [raw];
      for (const option of choices) {
        // CND_VAL is either a literal (e.g. 'rect') or an actual JSON variable
        // (e.g. BA compares b with d). Do not evaluate a literal as a variable.
        const rhs = values.get(option) ?? option;
        if (code === 3) {
          results.push(same(actual, rhs));
          continue;
        }
        if (code === 4) {
          results.push(!same(actual, rhs));
          continue;
        }
        const leftNum = Number(actual);
        const rightNum = Number(rhs);
        if (actual === '' || rhs === '') {
          results.push(false);
          continue;
        }
        if (!actual.trim() || !rhs.trim() || !Number.isFinite(leftNum) || !Number.isFinite(rightNum)) {
          unresolved = true;
          continue;
        }
        results.push(
          code === 1
            ? leftNum < rightNum
            : code === 2
              ? leftNum <= rightNum
              : code === 5
                ? leftNum >= rightNum
                : leftNum > rightNum,
        );
      }
    }
    if (unresolved) {
      unknown = true;
      continue;
    }
    if (!(code === 4 ? results.every(Boolean) : results.some(Boolean))) return false;
  }

  return unknown ? undefined : true;
}

// FLM role aliases already used by the project's existing XML rules. No aliases
// are inferred from spelling or connector numbers. Unknown roles remain intact.
function roleAliases(entity: FlmEntity): Map<string, string> {
  const fields = new Map(entity.geometry?.children.map((n) => [n.tag, n.text]) ?? []);
  const names =
    fields.get('ROLE') === '21'
      ? ['angle1', 'angle2']
      : ['14', '15'].includes(fields.get('ROLE') ?? '')
        ? ['angle']
        : [];

  const aliases = new Map(
    names.flatMap((name, i) => (fields.get('ROLEPARAM' + (i + 1)) ? [[name, fields.get('ROLEPARAM' + (i + 1))!]] : [])),
  );
  // Flanged tee/cross LIMITs use the legacy tlN name for the ft column
  // explicitly mapped as ftN by their Pipe restrictions. The C++ builders
  // subtract that same axial allowance through GetFlgSize on each branch.
  if (['15', '21'].includes(fields.get('ROLE') ?? '')) {
    for (const variable of entity.variables) {
      const suffix = variable.id.match(/^ft(\d+)$/)?.[1];
      if (
        suffix &&
        !entity.variables.some((item) => item.id === `tl${suffix}`) &&
        entity.restrictions.some((rule) =>
          rule.bindings.some((binding) => binding.variable === variable.id && binding.bindingTypeCode === 2),
        )
      )
        aliases.set(`tl${suffix}`, variable.id);
    }
  }

  return aliases;
}

export class CompiledConstraintGraph {
  readonly variables = new Map<string, FlmVariable>();
  readonly factors: ConstraintFactor[] = [];
  readonly edges = new Map<string, Set<string>>();
  readonly groups: DependencyGroup[];
  readonly aliases: Map<string, string>;
  readonly issues: ConstraintConflict[] = [];
  readonly unassignedDimensions = new Set<string>();
  readonly #tables = new Map<string, SpecificationIndex>();
  /** Source XML-compiled super-graph for the selected entity, never another catalog. */
  readonly sourceSuperGraph?: FlmCompiledGraph;

  /** Propagate only verified formula dependencies from the XML compiled graph.
   * Table factor direction/LEVEL semantics are deliberately NOT inferred here.
   */
  #mergeSourceDirections(source: FlmCompiledGraph, entityKey: string): void {
    if (
      source.v !== 'FLM-CONSTRAINT-GRAPH-1' ||
      !Array.isArray(source.nodes) ||
      !Array.isArray(source.factors) ||
      !Array.isArray(source.groups) ||
      !Array.isArray(source.edges) ||
      !Array.isArray(source.order)
    )
      return;
    const nodePrefix = `element/${entityKey}/`;

    const nodeName = (index: number): string | undefined => {
      const node = source.nodes[index];
      if (typeof node !== 'string' || !node.startsWith(nodePrefix)) return;
      const name = node.slice(nodePrefix.length);

      return this.variables.has(name) ? name : undefined;
    };

    // XML already records formula input/output directions explicitly. Merge
    // only those edges; relationships from table tuples stay bidirectional.
    for (const factor of source.factors) {
      if (!Array.isArray(factor) || !['F', 'L'].includes(factor[1])) continue;
      const dependencies = factor[3];
      const outputs = factor[4];
      if (!Array.isArray(dependencies) || !Array.isArray(outputs)) continue;
      for (const input of dependencies) {
        const from = nodeName(input);
        if (!from) continue;
        for (const output of outputs) {
          const to = nodeName(output);
          if (!to || to === from) continue;
          const edges = this.edges.get(from) ?? new Set<string>();
          edges.add(to);
          this.edges.set(from, edges);
        }
      }
    }
  }

  constructor(
    readonly library: ParsedLibraryJSON,
    readonly entity: FlmEntity,
  ) {
    this.aliases = new Map([...roleAliases(entity), ...Object.entries(entity.aliases ?? {})]);

    const compile = (definition: FlmEntity, scope: string) => {
      const key = (name: string) => scope + (!scope ? (this.aliases.get(name) ?? name) : name);

      for (const variable of definition.variables ?? []) this.variables.set(key(variable.id), variable);
      if (definition.initialValuesRaw?.children.length)
        this.issues.push({
          code: 'UNSUPPORTED_INITIAL_VALUES',
          message: `Uninterpreted initial values: ${definition.id}`,
        });
      for (const sourceRule of definition.restrictions ?? []) {
        // A zero-GUID list with only nonrestrictive input bindings supplies no
        // rows or equations. Keep its dimensions editable, without treating the
        // placeholder as an existing table or substituting another catalog.
        // Other missing tables and restrictive/output bindings remain errors.
        if (
          sourceRule.typeCode === 1 &&
          sourceRule.tableGuid === '00000000-0000-0000-0000-000000000000' &&
          !library.specifications[sourceRule.tableGuid] &&
          !Object.keys(sourceRule.conditionsRaw).length &&
          !sourceRule.extraFields.length &&
          sourceRule.bindings.length &&
          sourceRule.bindings.every(
            (binding) =>
              binding.bindingTypeCode === 1 &&
              binding.levelCode === 0 &&
              identifier.test(binding.variable) &&
              !binding.unknownXml?.length &&
              !Object.keys(binding.otherAttributes ?? {}).length,
          )
        ) {
          for (const binding of sourceRule.bindings) this.unassignedDimensions.add(key(binding.variable));
          continue;
        }
        // CND_VARn may reference inline VALUE_SET VALn instead of scalar
        // CND_RELn/CND_VALn. Compile its members as equality alternatives.
        const canonical = verifiedSourceConditions(library, definition, sourceRule);
        for (const field of canonical.invalidFields)
          this.issues.push({
            code: 'UNVERIFIED_CONDITION_LEXEME',
            message: `Source condition ${field} is not proven for ${definition.id}`,
          });
        const rule = {
          ...sourceRule,
          bindings: [...sourceRule.bindings],
          conditionsRaw: canonical.conditions,
        };
        // Some legacy Pipe maps omit a declared hidden output, although the
        // referenced table supplies a column with exactly that variable name
        // and a LIMIT consumes it (STFLN: df). Bind only this unambiguous case;
        // never rename columns or overwrite an explicit source mapping.
        if (
          rule.tableGuid &&
          library.specifications[rule.tableGuid] &&
          rule.bindings.some((binding) => binding.bindingTypeCode === 8)
        ) {
          const table = this.table(rule.tableGuid);
          table.table.columns.forEach((name, columnKey) => {
            if (
              !definition.variables.some((variable) => variable.id === name && variable.variableTypeCode === 7) ||
              definition.restrictions.some((restriction) =>
                restriction.bindings.some((binding) => binding.variable === name),
              ) ||
              definition.restrictions.filter(
                (restriction) =>
                  restriction.tableGuid &&
                  library.specifications[restriction.tableGuid]?.columns.includes(name) &&
                  restriction.bindings.some((binding) => binding.bindingTypeCode === 8),
              ).length !== 1 ||
              !definition.restrictions.some((restriction) =>
                restriction.extraFields.some(
                  (node) => node.tag === 'LIMIT' && inputs(node.attributes.EXPRESSION ?? '').includes(name),
                ),
              )
            )
              return;
            rule.bindings.push({ variable: name, columnKey, levelCode: 0, bindingTypeCode: 2 });
          });
        }
        for (const set of sourceRule.extraFields.filter((node) => node.tag === 'VALUE_SET')) {
          const index = set.attributes.NAME?.match(/^VAL(\d+)$/)?.[1];
          if (
            !index ||
            !Object.hasOwn(rule.conditionsRaw, `CND_VAR${index}`) ||
            Object.hasOwn(rule.conditionsRaw, `CND_REL${index}`)
          )
            continue;
          const members = set.children.filter((node) => node.tag === 'VALUE').map((node) => node.text ?? '');
          if (!members.length) continue;
          rule.conditionsRaw[`CND_REL${index}`] = 3;
          rule.conditionsRaw[`CND_VAL${index}`] = members.join(';');
        }
        const names = new Set<string>();

        const connect = (from: string, to: string) => {
          names.add(key(from));
          names.add(key(to));
          const edges = this.edges.get(key(from)) ?? new Set();
          edges.add(key(to));
          this.edges.set(key(from), edges);
        };

        const core = rule.bindings.filter(
          (b) => ![2, 5, 10].includes(b.bindingTypeCode) && !isSuggestedBinding(rule, b),
        );
        for (const b of rule.bindings) {
          for (const name of inputs(b.variable)) names.add(key(name));
          for (const a of core)
            for (const name of inputs(a.variable)) for (const target of inputs(b.variable)) connect(name, target);
        }
        for (const limit of rule.extraFields.filter((n) => n.tag === 'LIMIT')) {
          const target = limit.attributes.NAME;
          if (target) names.add(key(target));
          if (limit.attributes.TYPE === '1')
            for (const name of inputs(limit.attributes.EXPRESSION ?? '')) connect(name, target);
        }
        for (const [field, expression] of Object.entries(rule.conditionsRaw))
          if (field.startsWith('CND_VAR'))
            for (const name of inputs(String(expression)))
              for (const target of [...names]) connect(name, target.slice(scope.length));
        this.factors.push({
          id: `${scope}restriction:${rule.index}`,
          rule,
          scope,
          variables: [...names],
        });
      }
      // Child-local rules are safe to compile independently. Unsupported parent
      // bindings are retained in JSON and explicitly block a resolved snapshot.
      for (const child of definition.subElements ?? []) {
        compile(child, `${scope}child:${child.id}/`);
        if (child.unknownXml?.length || child.definitionRaw)
          this.issues.push({
            code: 'UNSUPPORTED_CHILD_BINDING',
            message: `Uninterpreted sub-element definition: ${child.id}`,
          });
      }
      for (const link of definition.connectors ?? [])
        if (link.variables?.length || link.restrictions?.length)
          compile(
            {
              id: link.id,
              guid: '',
              variables: link.variables ?? [],
              restrictions: link.restrictions ?? [],
              connectors: [],
            },
            `${scope}connector:${link.id}/`,
          );
    };

    compile(entity, '');
    // Link technology supplies optional physical sizes after solving. Only
    // explicit XML restrictions constrain element dimensions.
    // Every library keeps its own compiled graph. Missing/older JSON simply
    // follows the legacy graph builder with no cross-library lookup.
    // JSON keeps duplicate display symbols as GUID-qualified entity keys.
    // Never select the first entity's graph for a second entity with the
    // same name (IF@GUID, CMF@GUID, etc.). Match exact source GUID instead.
    const entityKey = Object.entries(library.entities).find(([, definition]) => definition.guid === entity.guid)?.[0];
    const source = entityKey ? library.constraintGraphs?.[entityKey] : undefined;
    if (
      entityKey &&
      source?.v === 'FLM-CONSTRAINT-GRAPH-1' &&
      Array.isArray(source.order) &&
      Array.isArray(source.groups)
    ) {
      this.sourceSuperGraph = source;
      this.#mergeSourceDirections(source, entityKey);
    }
    for (const name of [...this.variables.keys(), ...this.factors.flatMap((f) => f.variables)])
      if (!this.edges.has(name)) this.edges.set(name, new Set());
    this.groups = this.#components();
  }

  context(values: ReadonlyMap<string, string>, scope = ''): Map<string, string> {
    const result = new Map([...values].filter(([name]) => !name.includes('/')));
    // A connector/child-local variable shadows a global variable of the same
    // name; other expressions can still refer to inherited global parameters.
    if (scope) {
      for (const [name, value] of values)
        if (name.startsWith(scope) && !name.slice(scope.length).includes('/'))
          result.set(name.slice(scope.length), value);
    }
    for (const [alias, name] of this.aliases)
      if (result.has(name) && !result.has(alias)) result.set(alias, result.get(name)!);

    return result;
  }

  isSymbolicOutput(name: string): boolean {
    const variable = this.variables.get(name);
    if (!isSymbolicTechnologyIndex(name, variable)) return false;

    return this.factors.some(
      (factor) =>
        factor.rule.typeCode === 1 &&
        factor.rule.tableGuid &&
        this.library.specifications[factor.rule.tableGuid]?.id.toLowerCase() === 'mat_idx' &&
        factor.rule.bindings.some((binding) => binding.variable === name && binding.bindingTypeCode === 2),
    );
  }

  table(guid: string): SpecificationIndex {
    let table = this.#tables.get(guid);
    if (!table) {
      const definition = this.library.specifications[guid];
      if (!definition) throw new Error(`Missing specification: ${guid}`);
      table = new SpecificationIndex(definition);
      this.#tables.set(guid, table);
    }

    return table;
  }

  #components(): DependencyGroup[] {
    let serial = 0;
    const index = new Map<string, number>(),
      low = new Map<string, number>();
    const stack: string[] = [],
      onStack = new Set<string>(),
      groups: DependencyGroup[] = [];

    const visit = (name: string) => {
      index.set(name, serial);
      low.set(name, serial++);
      stack.push(name);
      onStack.add(name);
      for (const next of this.edges.get(name) ?? []) {
        if (!index.has(next)) {
          visit(next);
          low.set(name, Math.min(low.get(name)!, low.get(next)!));
        } else if (onStack.has(next)) low.set(name, Math.min(low.get(name)!, index.get(next)!));
      }
      if (low.get(name) !== index.get(name)) return;
      const variables: string[] = [];
      let next: string;
      do {
        next = stack.pop()!;
        onStack.delete(next);
        variables.push(next);
      } while (next !== name);
      groups.push({
        id: `group:${groups.length}`,
        variables,
        dependencies: [],
      });
    };

    for (const name of this.edges.keys()) if (!index.has(name)) visit(name);
    const owner = new Map(groups.flatMap((g) => g.variables.map((v) => [v, g] as const)));
    for (const [from, targets] of this.edges)
      for (const to of targets) {
        const a = owner.get(from)!,
          b = owner.get(to)!;
        if (a !== b && !b.dependencies.includes(a.id)) b.dependencies.push(a.id);
      }
    const ordered: DependencyGroup[] = [],
      seen = new Set<string>();

    const order = (group: DependencyGroup) => {
      if (seen.has(group.id)) return;
      seen.add(group.id);
      for (const dependency of group.dependencies) order(groups.find((g) => g.id === dependency)!);
      ordered.push(group);
    };

    groups.forEach(order);

    return ordered;
  }
}

interface TupleFactor {
  factor: ConstraintFactor;
  rows: Map<string, string>[];
  rowIds: number[];
  defaults: Map<string, string>[];
}
type Domains = Map<string, Set<string>>;

export class UnifiedConstraintSolver {
  readonly #cache = new Map<
    string,
    {
      key: string;
      values: Map<string, string>;
      options: Map<string, string[]>;
      conflict?: string;
    }
  >();

  constructor(readonly graph: CompiledConstraintGraph) {}

  solve(previous: ReadonlyMap<string, string> = new Map(), changed: readonly string[] = []): ResolvedSnapshot {
    const graph = this.graph,
      values = new Map(previous),
      pinned = new Set(changed);
    const options = new Map<string, string[]>(),
      conflicts: ConstraintConflict[] = [...graph.issues];
    const active = new Set<string>(),
      affected = new Set<string>();

    const addIssue = (code: string, message: string, restriction?: string) => {
      if (!conflicts.some((c) => c.code === code && c.message === message))
        conflicts.push({ code, message, restriction });
    };

    const deferredExpressions: ConstraintConflict[] = [];

    const initializeDefaults = () => {
      for (const [name, variable] of graph.variables) {
        if (values.has(name)) continue;
        const scope = name.slice(0, name.lastIndexOf('/') + 1);
        const context = graph.context(values, scope);
        for (const candidate of variable.defaultValues.map(flmText)) {
          if (candidate === undefined) continue;
          const value = variable.valueTypeCode === 3 ? candidate : expressionValue(candidate, context);
          // DEFAULT_VALUES is an ordered list of candidates. Numeric variables
          // may begin with an unavailable reference, followed by a literal.
          if (
            value === undefined ||
            (variable.valueTypeCode !== 3 && (!value.trim() || !Number.isFinite(Number(value))))
          )
            continue;
          values.set(name, value);
          break;
        }
        // A checkbox's unchecked value is explicitly described by the source.
        // XML <FALSE_VAL/> is an empty string, not an unresolved variable.
        if (
          !values.has(name) &&
          variable.valueTypeCode === 3 &&
          Object.hasOwn(variable.properties, 'TRUE_VAL') &&
          Object.hasOwn(variable.properties, 'FALSE_VAL')
        ) {
          const unchecked = variable.properties.FALSE_VAL;
          const value = unchecked === null ? '' : flmText(unchecked);
          if (value !== undefined) values.set(name, value);
        }
      }
    };

    initializeDefaults();

    // Normalize numeric input before table selection and formula evaluation.
    // A pin preserves the user's choice within its domain, not an out-of-range
    // value that would leave the editor and the committed geometry disagreeing.
    const normalizeBounds = () => {
      for (const [name, variable] of graph.variables) {
        const value = values.get(name);
        if (variable.valueTypeCode === 3 || !value?.trim() || !Number.isFinite(Number(value))) continue;
        const min = flmText(variable.properties.MIN_VALUE),
          max = flmText(variable.properties.MAX_VALUE);
        const lower = min === undefined ? -Infinity : Number(min),
          upper = max === undefined || Number(max) === 0 ? Infinity : Number(max);
        if (lower <= upper) {
          const bounded = Math.min(upper, Math.max(lower, Number(value)));
          if (bounded !== Number(value)) values.set(name, String(bounded));
        }
      }
    };

    normalizeBounds();

    // An XML tuple with multiple TYPE=8 input columns can prescribe the
    // other dimensions uniquely when one dimension is edited. The old values
    // belong to the previous tuple, not to explicit user pins (COGLD Corner).
    // Only propagate an unambiguous source row; do not pick arbitrary sizes.
    if (changed.length) {
      for (const factor of graph.factors) {
        if (
          factor.scope ||
          factor.rule.typeCode !== 1 ||
          !factor.rule.tableGuid ||
          !graph.library.specifications[factor.rule.tableGuid]
        )
          continue;
        const selectors = factor.rule.bindings.filter(
          (binding) => binding.bindingTypeCode === 8 && identifier.test(binding.variable),
        );
        if (selectors.length < 2 || !selectors.some((binding) => pinned.has(binding.variable))) continue;
        if (restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope)) !== true) continue;
        const table = graph.table(factor.rule.tableGuid);
        const matching = table.rows.filter((index) =>
          selectors.every(
            (binding) =>
              !pinned.has(binding.variable) ||
              same(table.columns[binding.columnKey][index], values.get(binding.variable)),
          ),
        );
        if (!matching.length) continue;

        // The edited input owns the choice. Other columns are preferences
        // from the old tuple, so select a compatible source row before their
        // individual lookups can accidentally pin the previous combination.
        const distance = (index: number) =>
          selectors.reduce((score, binding) => {
            const cell = table.columns[binding.columnKey][index];
            const current = values.get(binding.variable);
            if (same(cell, current)) return score;

            return (
              score +
              (cell?.trim() && current?.trim() && Number.isFinite(Number(cell)) && Number.isFinite(Number(current))
                ? Math.abs(Number(cell) - Number(current))
                : 1)
            );
          }, 0);

        const selected = matching.reduce((best, index) => (distance(index) < distance(best) ? index : best));
        for (const binding of selectors) {
          if (pinned.has(binding.variable)) continue;
          const cell = table.columns[binding.columnKey][selected];
          if (cell !== undefined) values.set(binding.variable, cell);
        }
      }
    }

    normalizeBounds();
    for (const [name, variable] of graph.variables) {
      const explicit = variable.options.map((o) => flmText(o.value)).filter((v): v is string => v !== undefined);
      if (explicit.length) options.set(name, [...new Set(explicit)]);
    }
    // Re-resolving an existing snapshot is not an edit. Only a fresh graph
    // initialization or explicitly changed inputs may trigger LEVEL>0 defaults.
    // Otherwise a valid editable l4=25 is silently reset to the table's l4=32.
    const touched = new Set(changed.length ? changed : previous.size ? [] : graph.variables.keys());
    for (const name of touched) for (const next of graph.edges.get(name) ?? []) touched.add(next);
    // Suggested dimensions refresh after dependency edits; explicit edits stay
    // pinned for this solve and are checked against the restrictive bounds.
    // Several independent Pipe lookups may output the *same* hidden working
    // dimension (for example three flange profiles each writing dm2). These
    // assignments are sequential, not an equality across unrelated input
    // diameters. Keep true shared selectors / joint table constraints intact.
    const derivedProducers = new Map<string, ConstraintFactor[]>();
    for (const factor of graph.factors) {
      for (const binding of factor.rule.bindings) {
        if (binding.bindingTypeCode !== 2 || !identifier.test(binding.variable)) continue;
        const name = factor.scope + binding.variable;
        const list = derivedProducers.get(name) ?? [];
        if (!list.includes(factor)) list.push(factor);
        derivedProducers.set(name, list);
      }
    }
    const writeOnlyOutputs = new Set<string>();
    for (const [name, writers] of derivedProducers) {
      if (writers.length < 2 || graph.variables.get(name)?.variableTypeCode !== 7) continue;
      // Require independent TYPE=8 diameter selectors with distinct input
      // names. Multi-column joins (such as TRREDPEX) must still share tuples.
      const selectors = writers.map((factor) =>
        factor.rule.bindings.filter((binding) => binding.bindingTypeCode === 8),
      );
      if (
        writers.some((factor) => Object.keys(factor.rule.conditionsRaw).length > 0) ||
        selectors.some((items) => items.length !== 1) ||
        new Set(selectors.map((items) => items[0].variable)).size !== writers.length ||
        graph.factors.some((factor) =>
          factor.rule.bindings.some(
            (binding) => factor.scope + binding.variable === name && ![2, 10].includes(binding.bindingTypeCode),
          ),
        )
      )
        continue;
      writeOnlyOutputs.add(name);
    }

    const suggestionInputs = new Map<object, string>();
    const tableSuggestionInputs = new Map<ConstraintFactor, string>();

    const limit = (factor: ConstraintFactor, report: boolean, suggest = true): void => {
      for (const node of factor.rule.extraFields) {
        if (node.tag !== 'LIMIT') {
          if (report) addIssue('UNSUPPORTED_RESTRICTION', `Unsupported ${node.tag}`, factor.id);
          continue;
        }
        // Earlier LIMITs in this factor may have just normalized an input used
        // by this expression. Evaluate against the current graph values.
        const context = graph.context(values, factor.scope);
        const a = node.attributes,
          name = factor.scope + a.NAME;
        const relation = Number(a.RELATION),
          formula = a.TYPE === '1';
        if (relation === 3 && !suggest) continue;
        if (![0, 1, 2, 3].includes(relation) || !['0', '1'].includes(a.TYPE)) {
          if (report) addIssue('UNSUPPORTED_RESTRICTION', `Unsupported limit codes ${a.TYPE}/${a.RELATION}`, factor.id);
          continue;
        }
        const expression = a.EXPRESSION ?? node.children.find((child) => child.tag === 'VALUE')?.text ?? '';
        // An empty numeric bound has no operand. It imposes no restriction;
        // do not turn the source's blank LIMIT into an unresolved formula.
        if ([1, 2].includes(relation) && !expression.trim()) continue;
        const expected = formula ? expressionValue(expression, context) : expression;
        if (expected === undefined) {
          const external = inputs(expression).filter(
            (input) =>
              !context.has(input) &&
              !graph.variables.has(factor.scope + input) &&
              !graph.factors.some(
                (producer) =>
                  producer.scope === factor.scope &&
                  (producer.rule.bindings.some((b) => b.variable === input) ||
                    producer.rule.extraFields.some((n) => n.tag === 'LIMIT' && n.attributes.NAME === input)),
              ),
          );
          // Hidden terminal calculations may require host/project inputs which
          // are absent in a standalone library. Keep them unresolved, rather
          // than inventing values or blocking independent geometry. Any actual
          // get_val consumer is still checked against the committed snapshot.
          if (
            formula &&
            relation === 0 &&
            external.length &&
            graph.variables.get(name)?.variableTypeCode === 7 &&
            !graph.edges.get(name)?.size &&
            !pinned.has(name)
          ) {
            values.delete(name);
            if (report)
              deferredExpressions.push({
                code: 'MISSING_EXTERNAL_INPUT',
                message: `${name}: waiting for ${external.join(', ')} (${expression})`,
                restriction: factor.id,
              });
            continue;
          }
          // Default display can be constructed from a validated table-selected
          // length even when an additional minimum formula refers to an
          // unavailable *external* dimension. Preserve the source LIMIT and
          // expose the uncertainty. An edited/pinned value is never accepted
          // without being able to check its bound.
          const hasSourceLength = graph.factors.some(
            (producer) =>
              producer.scope === factor.scope &&
              producer.rule.typeCode === 1 &&
              producer.rule.bindings.some((binding) => binding.variable === a.NAME && binding.bindingTypeCode === 1),
          );
          const existing = values.get(name);
          if (
            report &&
            formula &&
            [1, 2].includes(relation) &&
            hasSourceLength &&
            !pinned.has(name) &&
            existing?.trim() &&
            Number.isFinite(Number(existing))
          ) {
            deferredExpressions.push({
              code: 'DEFERRED_LENGTH_BOUND',
              message: `${a.NAME}: source LIMIT not evaluated (${expression}); using table value ${existing}`,
              restriction: factor.id,
            });
            continue;
          }
          if (report) addIssue('UNRESOLVED_EXPRESSION', `Cannot resolve ${a.NAME}: ${a.EXPRESSION}`, factor.id);
          continue;
        }
        const current = values.get(name);
        // An absent optional input also leaves its numeric bounds absent.
        if (expected === '' && (relation === 1 || relation === 2)) continue;
        if (relation === 0) {
          const allowed = formula
            ? [expected]
            : node.children.filter((child) => child.tag === 'VALUE' && child.text !== null).map((child) => child.text!);
          if (!allowed.length) allowed.push(expected);
          options.set(name, allowed);
          if (!allowed.some((v) => same(v, current))) {
            if (!report && !pinned.has(name)) values.set(name, allowed[0]);
            else if (report) addIssue('LIMIT_CONFLICT', `${a.NAME} must be one of ${allowed.join(', ')}`, factor.id);
          }
          continue;
        }
        if (relation === 3) {
          // Nonrestrictive LIMITs provide a suggested value, not an equality.
          // Reapply only when their inputs change: applying on every pass would
          // undo min/max clamping and reject otherwise valid manual dimensions.
          const dependencies = [
            ...(formula ? inputs(expression) : []),
            ...Object.entries(factor.rule.conditionsRaw)
              .filter(([key]) => key.startsWith('CND_VAR'))
              .flatMap(([, value]) => inputs(String(value))),
          ];
          const fingerprint = JSON.stringify(dependencies.map((input) => [input, context.get(input)]));
          const earlier = suggestionInputs.get(node);
          const refresh =
            earlier === undefined
              ? dependencies.some((input) => touched.has(factor.scope + input))
              : earlier !== fingerprint;
          if (!report) {
            suggestionInputs.set(node, fingerprint);
            if (!pinned.has(name) && (current === undefined || refresh)) values.set(name, expected);
          }
          continue;
        }
        if (
          current === undefined ||
          (relation === 1 ? Number(current) < Number(expected) : Number(current) > Number(expected))
        ) {
          if (!report) values.set(name, expected);
          else if (report) addIssue('LIMIT_CONFLICT', `${a.NAME} is not resolved within its bounds`, factor.id);
        }
      }
    };

    let stable = false;
    let lastTables: TupleFactor[] = [];
    const visited = new Set<string>();
    for (let pass = 0; pass <= graph.factors.length + 2; ++pass) {
      const before = JSON.stringify([...values].sort());
      // Suggestion fingerprints are solver state too: revisiting the same
      // values after accepting a table choice is not necessarily a cycle.
      const stateKey = JSON.stringify([before, [...suggestionInputs.values()]]);
      if (visited.has(stateKey)) {
        addIssue('NON_CONVERGENT', 'Restrictions do not converge');
        break;
      }
      visited.add(stateKey);
      conflicts.splice(0, conflicts.length, ...graph.issues);
      initializeDefaults();
      normalizeBounds();
      // Restore a *literal XML default* when an optional source input was
      // cleared by a previously selected branch and is now selected again.
      // This is branch-sensitive: an active explicit empty LIMIT always wins.
      // General/RRAF* switches rectangular -> circular -> rectangular without
      // leaving a/b as stale empty strings or fabricating numeric zero.
      for (const [name, variable] of graph.variables) {
        if (values.get(name) !== '' || pinned.has(name)) continue;
        const slash = name.lastIndexOf('/');
        const scope = slash < 0 ? '' : name.slice(0, slash + 1);
        const localName = name.slice(slash + 1);
        const relevant = graph.factors.filter(
          (factor) =>
            factor.scope === scope &&
            restrictionActive(factor.rule.conditionsRaw, graph.context(values, scope)) === true,
        );
        const explicitlyCleared = relevant.some((factor) =>
          factor.rule.extraFields.some(
            (node) =>
              node.tag === 'LIMIT' &&
              node.attributes.NAME === localName &&
              node.attributes.TYPE === '0' &&
              ['0', '3'].includes(node.attributes.RELATION) &&
              node.children.some((child) => child.tag === 'VALUE') &&
              node.children.filter((child) => child.tag === 'VALUE').every((child) => !child.text),
          ),
        );
        if (
          explicitlyCleared ||
          !relevant.some((factor) => factor.rule.bindings.some((binding) => binding.variable === localName))
        )
          continue;
        const fallback = variable.defaultValues
          .map(flmText)
          .find((candidate) => candidate !== undefined && candidate.trim() !== '');
        if (fallback !== undefined) values.set(name, fallback);
      }
      // Derived outputs whose producers are all inactive have no value in this
      // configuration. Clear previous-branch results, and propagate absence so
      // downstream numeric conditions do not activate or report missing inputs.
      const producers = new Map<string, ConstraintFactor[]>();
      for (const factor of graph.factors) {
        const outputs = [
          ...factor.rule.bindings.filter((b) => [1, 2, 5, 10].includes(b.bindingTypeCode)).map((b) => b.variable),
          ...factor.rule.extraFields
            .filter((n) => n.tag === 'LIMIT' && ['0', '3'].includes(n.attributes.RELATION))
            .map((n) => n.attributes.NAME),
        ];
        for (const output of outputs) {
          const name = factor.scope + output;
          const factors = producers.get(name) ?? [];
          factors.push(factor);
          producers.set(name, factors);
        }
      }
      for (const [name, factors] of producers)
        if (
          !pinned.has(name) &&
          // An editable input remains an input when its suggestion table is
          // inactive. Clearing it would erase the nominal size on tech changes
          // and then clear every formula fed by that size.
          !(
            graph.variables.get(name)?.variableTypeCode !== 7 &&
            factors.some((factor) =>
              factor.rule.bindings.some(
                (binding) => binding.bindingTypeCode === 1 && factor.scope + binding.variable === name,
              ),
            )
          ) &&
          // A conditional branch does not own a source input just because it
          // optionally clears that input in a different configuration.
          // Keep a declared XML default (General/RRAF*: a,b) available to the
          // active table/geometry branch. Only clear genuinely derived values.
          !(graph.variables.get(name)?.defaultValues ?? []).some((candidate) => !!flmText(candidate)?.trim()) &&
          factors.every(
            (factor) => restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope)) === false,
          )
        )
          values.set(name, '');
      active.clear();
      options.clear();
      for (const [name, variable] of graph.variables) {
        const explicit = variable.options.map((o) => flmText(o.value)).filter((v): v is string => v !== undefined);
        if (explicit.length) options.set(name, [...new Set(explicit)]);
      }
      const tables: TupleFactor[] = [];
      // XML can declare an editable LEVEL>0 list and repeat its columns in a
      // lookup restriction. Both refer to the same suggested dimensions; the
      // repeated lookup must not turn them into fixed equalities that contradict
      // their explicit minimum/maximum formulas.
      const suggestedColumns = new Set<string>();
      for (const factor of graph.factors)
        if (restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope)) === true)
          for (const b of factor.rule.bindings)
            if (b.bindingTypeCode === 1 && b.levelCode > 0)
              suggestedColumns.add(JSON.stringify([factor.scope, factor.rule.tableGuid, b.columnKey, b.variable]));
      const bounds = new Map<string, { min?: number; max?: number }>();
      const cleared = new Set<string>();
      for (const factor of graph.factors) {
        const context = graph.context(values, factor.scope);
        if (restrictionActive(factor.rule.conditionsRaw, context) !== true) continue;
        for (const node of factor.rule.extraFields.filter((node) => node.tag === 'LIMIT')) {
          const a = node.attributes,
            relation = Number(a.RELATION);
          if (
            [0, 3].includes(relation) &&
            a.TYPE === '0' &&
            node.children.some((child) => child.tag === 'VALUE') &&
            node.children.filter((child) => child.tag === 'VALUE').every((child) => !child.text)
          )
            cleared.add(factor.scope + a.NAME);
          if (![1, 2].includes(relation) || !['0', '1'].includes(a.TYPE)) continue;
          const expression = a.EXPRESSION ?? node.children.find((child) => child.tag === 'VALUE')?.text ?? '';
          const resolved = a.TYPE === '1' ? expressionValue(expression, context) : expression;
          if (resolved === undefined || !resolved.trim() || !Number.isFinite(Number(resolved))) continue;
          const name = factor.scope + a.NAME,
            current = bounds.get(name) ?? {};
          if (relation === 1) current.min = Math.max(current.min ?? -Infinity, Number(resolved));
          else current.max = Math.min(current.max ?? Infinity, Number(resolved));
          bounds.set(name, current);
        }
      }
      for (const factor of graph.factors) {
        const enabled = restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope));
        if (enabled !== true) continue;
        active.add(factor.id);
        if (
          // ARG_CAT is retained as category metadata, not a binding opcode.
          // The explicit DEF_ARGMAP entries define variables, columns and types.
          factor.rule.bindings.some(
            (binding) => binding.unknownXml?.length || Object.keys(binding.otherAttributes ?? {}).length,
          )
        ) {
          addIssue('UNSUPPORTED_BINDING', `Uninterpreted argument mapping in ${factor.id}`, factor.id);
          continue;
        }
        if (factor.rule.typeCode === 2 && !factor.rule.tableGuid) {
          limit(factor, false);
          continue;
        }
        if (factor.rule.typeCode !== 1 || !factor.rule.tableGuid) continue;
        // A source rule explicitly clearing an optional selector disables its
        // list of available sizes. It does not choose the first size in that
        // list and then conflict with the same source's empty-value rule.
        if (
          factor.rule.bindings.length &&
          factor.rule.bindings.every(
            (binding) => [0, 1].includes(binding.bindingTypeCode) && cleared.has(factor.scope + binding.variable),
          )
        )
          continue;
        const unsupported = factor.rule.bindings.find((b) => ![0, 1, 2, 5, 6, 7, 8, 9, 10].includes(b.bindingTypeCode));
        if (unsupported) {
          // Source JSON does not define the semantics of these FLM operators;
          // never treat them as an ordinary equality or silently ignore them.
          addIssue(
            'UNSUPPORTED_BINDING',
            `Unsupported DEF_ARGMAP TYPE ${unsupported.bindingTypeCode}: ${unsupported.variable} in ${factor.id}`,
            factor.id,
          );
          continue;
        }
        try {
          const table = graph.table(factor.rule.tableGuid);
          const context = graph.context(values, factor.scope);
          const rows: Map<string, string>[] = [],
            defaults: Map<string, string>[] = [],
            rowIds: number[] = [];
          let candidates: readonly number[] = table.rows;
          // Numeric input bindings use the native interpolation rules. Exact
          // string inputs still filter source rows before numeric evaluation.
          const numericInputs: NumericLookupInput[] = [];
          const selectorRows = new Map<(typeof factor.rule.bindings)[number], ReadonlySet<number>>();
          const absentSelector = factor.rule.bindings.some(
            (binding) =>
              ([7, 8, 9].includes(binding.bindingTypeCode) && expressionValue(binding.variable, context) === '') ||
              // TYPE 5 participates in row selection/output. An active Single
              // restriction can explicitly clear that optional dimension. The
              // lookup must then clear its dependent outputs, not pick a size
              // row which the Single restriction will erase after table solving.
              (binding.bindingTypeCode === 5 && cleared.has(factor.scope + binding.variable)),
          );
          if (absentSelector) {
            // An explicitly cleared selector (e.g. no spigot) cannot select a
            // size row. Its lookup outputs are absent too, not a fabricated row.
            for (const binding of factor.rule.bindings)
              if ([2, 5, 10].includes(binding.bindingTypeCode) && !pinned.has(factor.scope + binding.variable))
                values.set(factor.scope + binding.variable, '');
            continue;
          }
          for (const binding of factor.rule.bindings) {
            const code = binding.bindingTypeCode;
            if (![6, 7, 8, 9].includes(code) && identifier.test(binding.variable)) continue;
            const result = expressionValue(binding.variable, context);
            if (code === 8 && result === undefined) continue; // Legacy unknown input may be inferred elsewhere.
            if (result === undefined || ((code === 7 || code === 9) && !result.trim())) {
              if (code === 7 || code === 9)
                throw new Error(`Unsupported DEF_ARGMAP TYPE ${code}: missing input ${binding.variable}`);
              throw new Error(`Unresolved table expression: ${binding.variable}`);
            }
            if ([8, 9].includes(code)) {
              if (!result.trim() || !Number.isFinite(Number(result)))
                throw new Error(`Invalid numeric lookup input: ${binding.variable}=${result}`);
              numericInputs.push({ column: binding.columnKey, value: Number(result), extrapolate: code === 9 });
              selectorRows.set(binding, new Set(table.rows));
              continue;
            }
            const matching = table.matching(binding.columnKey, result);
            if (code === 7 && matching.size === 0)
              throw new Error(`Unsupported DEF_ARGMAP TYPE ${code}: no exact row for ${binding.variable}=${result}`);
            selectorRows.set(binding, matching);
            candidates = candidates.filter((index) => matching.has(index));
          }
          const interpolated = numericInputs.length
            ? interpolateTable(table, candidates, numericInputs, [
                ...new Set(factor.rule.bindings.map((binding) => binding.columnKey)),
              ])
            : undefined;
          if (interpolated) candidates = candidates.slice(0, 1);
          // Several output bindings may assign the same FLM variable in a
          // single DEF_ARGMAP. They are sequential assignments, NOT an equality
          // assertion between unrelated specification columns. The final
          // TYPE=2 assignment is authoritative for that output in this rule.
          // Selectors/input bindings still constrain the candidate row.
          const lastOutputBinding = new Map<string, number>();
          factor.rule.bindings.forEach((binding, index) => {
            if (binding.bindingTypeCode !== 2 || !identifier.test(binding.variable)) return;
            const name =
              factor.scope +
              (!factor.scope ? (graph.aliases.get(binding.variable) ?? binding.variable) : binding.variable);
            lastOutputBinding.set(name, index);
          });
          for (const rowIndex of candidates) {
            const row = new Map<string, string>(),
              suggested = new Map<string, string>();
            let accept = true;
            for (const [bindingIndex, b] of factor.rule.bindings.entries()) {
              const cells = table.columns[b.columnKey];
              if (!cells) throw new Error(`Missing column ${b.columnKey}`);
              const cell = interpolated?.get(b.columnKey) ?? cells[rowIndex];
              if (cell === undefined) {
                accept = false;
                break;
              }
              if (selectorRows.has(b)) {
                // Candidates were already filtered by this input binding.
                if (!selectorRows.get(b)!.has(rowIndex)) accept = false;
              } else {
                const name =
                  factor.scope + (!factor.scope ? (graph.aliases.get(b.variable) ?? b.variable) : b.variable);
                if (b.bindingTypeCode === 2 && lastOutputBinding.get(name) !== bindingIndex) continue;
                if (row.has(name) && !same(row.get(name), cell)) accept = false;
                // Keep standalone choices and editable dependent dimensions
                // out of the tuple equality constraints.
                if (
                  isSuggestedBinding(factor.rule, b) ||
                  (b.bindingTypeCode === 2 && writeOnlyOutputs.has(name)) ||
                  (b.bindingTypeCode === 2 &&
                    suggestedColumns.has(
                      JSON.stringify([factor.scope, factor.rule.tableGuid, b.columnKey, b.variable]),
                    ))
                )
                  suggested.set(name, cell);
                else row.set(name, cell);
                // Dependent suggestions can be clamped by LIMITs after row
                // selection; filtering them would discard their valid inputs.
                if (suggested.has(name) && factor.rule.bindings.length > 1) continue;
                const variable = graph.variables.get(name);
                if (variable?.options.length && !variable.options.some((o) => same(flmText(o.value), cell)))
                  accept = false;
                if (variable && variable.valueTypeCode !== 3 && !graph.isSymbolicOutput(name)) {
                  const min = flmText(variable.properties.MIN_VALUE),
                    max = flmText(variable.properties.MAX_VALUE);
                  if (
                    !cell.trim() ||
                    !Number.isFinite(Number(cell)) ||
                    (min !== undefined && Number(cell) < Number(min)) ||
                    (max !== undefined && Number(max) !== 0 && Number(cell) > Number(max))
                  )
                    accept = false;
                }
                const bound = bounds.get(name);
                if (bound && (Number(cell) < (bound.min ?? -Infinity) || Number(cell) > (bound.max ?? Infinity)))
                  accept = false;
              }
            }
            if (accept) {
              rows.push(row);
              defaults.push(suggested);
              rowIds.push(rowIndex);
            }
          }
          if (
            !rows.length &&
            factor.rule.bindings.length === 1 &&
            isSuggestedBinding(factor.rule, factor.rule.bindings[0])
          ) {
            // Bounds may exclude every suggestion while still allowing a
            // manually entered dimension. An empty menu is not a contradiction.
            rows.push(new Map());
            defaults.push(new Map());
          }
          tables.push({ factor, rows, rowIds, defaults });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          addIssue(
            message.startsWith('Unsupported DEF_ARGMAP TYPE') || message.startsWith('Unsupported TYPE 8')
              ? 'UNSUPPORTED_BINDING'
              : 'UNRESOLVED_TABLE',
            `${factor.id}: ${message}`,
            factor.id,
          );
        }
      }
      // Partition connected table factors. Independent tables never create a
      // global Cartesian product; coupled factors retain their complete tuples.
      const remaining = new Set(tables);
      while (remaining.size) {
        const component: TupleFactor[] = [remaining.values().next().value!];
        remaining.delete(component[0]);
        const names = new Set<string>(component[0].rows.flatMap((r) => [...r.keys()]));
        for (let i = 0; i < component.length; ++i)
          for (const candidate of remaining)
            if (candidate.rows.some((row) => [...row.keys()].some((name) => names.has(name)))) {
              component.push(candidate);
              remaining.delete(candidate);
              candidate.rows.forEach((row) => row.forEach((_, name) => names.add(name)));
            }
        const cacheId = component.map((f) => f.factor.id).join('|');
        const key = JSON.stringify([
          component.map((f) => [f.factor.id, f.rowIds, f.rows.map((row) => [...row])]),
          [...names].map((n) => [n, values.get(n), pinned.has(n)]),
          component.map((f) =>
            f.defaults.map((defaults) =>
              [...defaults.keys()].map((name) => [name, values.get(name), pinned.has(name)]),
            ),
          ),
        ]);
        let result = this.#cache.get(cacheId);
        if (result?.key !== key) {
          for (const group of graph.groups) if (group.variables.some((name) => names.has(name))) affected.add(group.id);
          const resolved = this.#solveTables(component, values, pinned);
          result = { key, ...resolved };
          this.#cache.set(cacheId, result);
        }
        if (result.conflict) {
          addIssue(
            result.conflict === 'Search limit exceeded' ? 'SEARCH_LIMIT' : 'TABLE_CONFLICT',
            result.conflict,
            component[0].factor.id,
          );
          continue;
        }
        for (const [name, value] of result.values) values.set(name, value);
        for (const [name, choices] of result.options) options.set(name, choices);
        for (const tuple of component) {
          const matches = (r: Map<string, string>) => [...r].every(([name, v]) => same(values.get(name), v));

          // Nonrestrictive inputs rank suggested rows; they never become hard
          // equalities. LEVEL orders dependent defaults, not edit permissions.
          const roots = tuple.factor.rule.bindings.filter((b) => b.bindingTypeCode === 1 && b.levelCode === 0);
          let row = tuple.rows.findIndex(
            (r, i) =>
              matches(r) &&
              roots.every((b) => {
                const name =
                  tuple.factor.scope +
                  (tuple.factor.scope ? b.variable : (graph.aliases.get(b.variable) ?? b.variable));
                const current = values.get(name);

                return (
                  current === undefined ||
                  !tuple.defaults.some((d) => same(d.get(name), current)) ||
                  same(tuple.defaults[i].get(name), current)
                );
              }),
          );
          if (row < 0) row = tuple.rows.findIndex(matches);
          if (row < 0) continue;
          // Conditions and explicit lookup inputs may change on a later pass
          // (tech -> mat_idx -> size table). Refresh dependent defaults then,
          // rather than only on pass zero with the previous technology.
          const context = graph.context(values, tuple.factor.scope);
          const dependencies = new Set([
            ...tuple.factor.rule.bindings
              .filter((binding) => [6, 7, 8, 9].includes(binding.bindingTypeCode))
              .flatMap((binding) => inputs(binding.variable)),
            ...Object.entries(tuple.factor.rule.conditionsRaw)
              .filter(([key]) => key.startsWith('CND_VAR'))
              .flatMap(([, value]) => inputs(String(value))),
          ]);
          const fingerprint = JSON.stringify([...dependencies].map((name) => [name, context.get(name)]));
          const earlier = tableSuggestionInputs.get(tuple.factor);
          const refresh =
            earlier === undefined ? tuple.factor.variables.some((name) => touched.has(name)) : earlier !== fingerprint;
          tableSuggestionInputs.set(tuple.factor, fingerprint);
          for (const [name, suggestion] of tuple.defaults[row]) {
            if (!options.has(name))
              options.set(name, [
                ...new Set(tuple.defaults.map((d) => d.get(name)).filter((v): v is string => v !== undefined)),
              ]);
            if (!pinned.has(name) && (!values.has(name) || refresh)) values.set(name, suggestion);
          }
        }
      }
      for (const factor of graph.factors)
        if (active.has(factor.id) && factor.rule.typeCode === 2 && !factor.rule.tableGuid) limit(factor, false, false);
      normalizeBounds();
      lastTables = tables;
      const earlier = new Map<string, string>(JSON.parse(before));
      // Formula feedback (e.g. L >= l1+l2, l2 suggested as L/2) can
      // converge numerically without ever producing identical float strings.
      // Retain the newly clamped values; only use tolerance for convergence.
      const converged =
        earlier.size === values.size &&
        [...values].every(([name, value]) => {
          const previous = earlier.get(name);

          return (
            same(previous, value) ||
            (previous?.trim() &&
              value.trim() &&
              Number.isFinite(Number(previous)) &&
              Number.isFinite(Number(value)) &&
              Math.abs(Number(previous) - Number(value)) <= 1e-9 * Math.max(1, Math.abs(Number(value))))
          );
        });
      if (converged) {
        stable = true;
        break;
      }
      for (const [name, value] of values) if (!same(earlier.get(name), value)) touched.add(name);
      for (const name of touched) for (const next of graph.edges.get(name) ?? []) touched.add(next);
    }
    if (!stable && !conflicts.length) addIssue('NON_CONVERGENT', 'Restrictions did not reach a stable configuration');
    for (const tuple of lastTables)
      if (!tuple.rows.some((row) => [...row].every(([name, value]) => same(values.get(name), value))))
        addIssue('TABLE_CONFLICT', `Final values violate ${tuple.factor.id}`, tuple.factor.id);
    for (const factor of graph.factors) {
      const enabled = restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope));
      if (enabled === undefined && !factor.id.includes('/technology:'))
        addIssue('UNRESOLVED_CONDITION', `Cannot evaluate conditions for ${factor.id}`, factor.id);
      if (enabled !== true) continue;
      if (factor.rule.typeCode === 2 && !factor.rule.tableGuid) limit(factor, true);
      else if (factor.rule.typeCode === 1 && !factor.rule.tableGuid)
        addIssue('UNRESOLVED_TABLE', `Missing table GUID for ${factor.id}`, factor.id);
      else if (factor.rule.typeCode !== 1)
        addIssue('UNSUPPORTED_RESTRICTION', `Unknown restriction type ${factor.rule.typeCode}`, factor.id);
    }
    for (const [name, variable] of graph.variables) {
      const value = values.get(name);
      if (value === undefined) {
        if (variable.defaultValues.some((candidate) => flmText(candidate)?.trim()))
          addIssue('UNRESOLVED_DEFAULT', `Cannot resolve defaults for ${name}`);
        continue; // Unreferenced optional variables need not have values.
      }
      if (![1, 2, 3].includes(variable.valueTypeCode)) addIssue('UNSUPPORTED_TYPE', `Unknown variable type: ${name}`);
      else if (value === '' && !pinned.has(name))
        continue; // Absent optional output; execution validates consumers.
      // Both numeric FLM codes occur with fractional dimensions in real source
      // tables. Preserve the code; do not infer an integer-only UI restriction.
      else if (
        variable.valueTypeCode !== 3 &&
        !graph.isSymbolicOutput(name) &&
        (!value.trim() || !Number.isFinite(Number(value)))
      )
        addIssue('TYPE_CONFLICT', `Invalid number: ${name}=${value}`);
      const min = flmText(variable.properties.MIN_VALUE),
        max = flmText(variable.properties.MAX_VALUE);
      // In this FLM dialect MAX_VALUE=0 denotes an unspecified upper bound.
      if (
        variable.valueTypeCode !== 3 &&
        !graph.isSymbolicOutput(name) &&
        ((min !== undefined && Number(value) < Number(min)) ||
          (max !== undefined && Number(max) !== 0 && Number(value) > Number(max)))
      )
        addIssue('RANGE_CONFLICT', `Value outside bounds: ${name}=${value}`);
      if (variable.options.length && !variable.options.some((o) => same(flmText(o.value), value)))
        addIssue('OPTION_CONFLICT', `Invalid option: ${name}=${value}`);
    }
    const unresolved = conflicts.some((c) => !c.code.endsWith('_CONFLICT'));
    for (const group of graph.groups) if (group.variables.some((name) => touched.has(name))) affected.add(group.id);

    // The dropdown is a set of suggestions, not the accepted domain, for
    // active Nonrestrictive columns. Expose that fact separately to the UI.
    const nonrestrictiveParameters = new Set<string>();
    const missingDimensions = [...graph.unassignedDimensions].filter((name) => !values.has(name));
    if (missingDimensions.length)
      deferredExpressions.push({
        code: 'UNASSIGNED_DIMENSION_LIST',
        message: `Enter dimensions: ${missingDimensions.join(', ')} (no default values in the library)`,
      });
    for (const name of graph.unassignedDimensions) nonrestrictiveParameters.add(name);
    for (const factor of graph.factors) {
      if (restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope)) !== true) continue;
      for (const node of factor.rule.extraFields)
        if (node.tag === 'LIMIT' && node.attributes.RELATION === '3')
          nonrestrictiveParameters.add(factor.scope + node.attributes.NAME);
      for (const binding of factor.rule.bindings) {
        if (!isSuggestedBinding(factor.rule, binding) || !identifier.test(binding.variable)) continue;
        nonrestrictiveParameters.add(
          factor.scope + (!factor.scope ? (graph.aliases.get(binding.variable) ?? binding.variable) : binding.variable),
        );
      }
    }

    const parameterModes = new Map<string, ParameterBindingMode>();
    const outputs = new Set<string>();
    for (const name of nonrestrictiveParameters) parameterModes.set(name, 'nonrestrictive');
    for (const factor of graph.factors) {
      if (restrictionActive(factor.rule.conditionsRaw, graph.context(values, factor.scope)) !== true) continue;

      const key = (name: string) => factor.scope + (factor.scope ? name : (graph.aliases.get(name) ?? name));

      for (const binding of factor.rule.bindings) {
        if (!identifier.test(binding.variable)) continue;
        const name = key(binding.variable);
        if (binding.bindingTypeCode === 0) parameterModes.set(name, 'restrictive');
        else if ([2, 10].includes(binding.bindingTypeCode)) outputs.add(name);
      }
      for (const node of factor.rule.extraFields) {
        if (node.tag !== 'LIMIT') continue;
        if (node.attributes.RELATION === '0') {
          if (node.attributes.TYPE === '1') outputs.add(key(node.attributes.NAME));
          else parameterModes.set(key(node.attributes.NAME), 'restrictive');
        }
      }
    }
    for (const name of outputs) parameterModes.set(name, 'secondary');
    for (const name of graph.variables.keys())
      if (!parameterModes.has(name)) parameterModes.set(name, 'nonrestrictive');

    return {
      resolvedValues: values,
      parameterModes,
      missingInputs: missingDimensions,
      deferredExpressions,
      validOptions: options,
      nonrestrictiveParameters,
      activeRestrictions: [...active],
      affectedGroups: [...affected],
      conflicts,
      status: conflicts.length ? (unresolved ? 'unresolved' : 'conflict') : 'valid',
    };
  }

  #solveTables(factors: TupleFactor[], preferences: ReadonlyMap<string, string>, pinned: ReadonlySet<string>) {
    const seed: Domains = new Map();
    for (const factor of factors)
      for (const row of factor.rows)
        for (const [name, value] of row) {
          const domain = seed.get(name) ?? new Set();
          domain.add(value);
          seed.set(name, domain);
        }
    for (const name of pinned)
      if (seed.has(name) && preferences.has(name)) seed.set(name, new Set([preferences.get(name)!]));
    let nodes = 0,
      exceeded = false;

    const clone = (domains: Domains): Domains => new Map([...domains].map(([n, d]) => [n, new Set(d)]));

    const propagate = (domains: Domains): boolean => {
      let changed = true;
      while (changed) {
        changed = false;
        for (const factor of factors) {
          const rows = factor.rows.filter((row) =>
            [...row].every(([name, cell]) => [...(domains.get(name) ?? [])].some((v) => same(v, cell))),
          );
          if (!rows.length) return false;
          for (const name of rows[0].keys()) {
            const allowed = new Set(rows.map((row) => row.get(name)!));
            const current = domains.get(name)!;
            const next = new Set([...current].filter((v) => [...allowed].some((a) => same(a, v))));
            if (!next.size) return false;
            if (next.size !== current.size) {
              domains.set(name, next);
              changed = true;
            }
          }
        }
      }

      return true;
    };

    const search = (domains: Domains): Domains | undefined => {
      if (++nodes > 20000) {
        exceeded = true;

        return undefined;
      }
      if (!propagate(domains)) return undefined;
      const choice = [...domains].filter(([, d]) => d.size > 1).sort((a, b) => a[1].size - b[1].size)[0];
      if (!choice) return domains;
      const [name, domain] = choice;
      const preference = preferences.get(name);

      const distance = (value: string) =>
        preference?.trim() && value.trim() && Number.isFinite(Number(preference)) && Number.isFinite(Number(value))
          ? Math.abs(Number(value) - Number(preference))
          : 0;

      // Suggested input columns are not equalities, but they outrank stale
      // derived outputs when choosing a new source row. After changing tech,
      // preserve a supported nominal diameter instead of matching the old
      // connector's outer diameter and thereby jumping to another size.
      const inputDistance = (value: string) =>
        factors.reduce((total, factor) => {
          const roots = factor.factor.rule.bindings.filter(
            (binding) => binding.bindingTypeCode === 1 && binding.levelCode === 0,
          );
          if (!roots.length || !factor.rows.some((row) => row.has(name))) return total;
          const scores = factor.rows.flatMap((row, index) => {
            if (
              !same(row.get(name), value) ||
              ![...row].every(([key, cell]) => [...(domains.get(key) ?? [])].some((candidate) => same(candidate, cell)))
            )
              return [];

            return [
              roots.reduce((score, binding) => {
                const key =
                  factor.factor.scope +
                  (factor.factor.scope
                    ? binding.variable
                    : (this.graph.aliases.get(binding.variable) ?? binding.variable));
                const wanted = preferences.get(key),
                  cell = factor.defaults[index].get(key);
                if (wanted === undefined || cell === undefined || same(wanted, cell)) return score;

                return (
                  score +
                  (wanted.trim() && cell.trim() && Number.isFinite(Number(wanted)) && Number.isFinite(Number(cell))
                    ? Math.abs(Number(wanted) - Number(cell)) / Math.max(1, Math.abs(Number(wanted)))
                    : 1)
                );
              }, 0),
            ];
          });

          return total + (scores.length ? Math.min(...scores) : Infinity);
        }, 0);

      const rankedInputs = new Map([...domain].map((value) => [value, inputDistance(value)]));

      // A suggestion ranks valid tuples; it must not force a value outside a
      // restrictive table. Pins and exact lookup selectors remain mandatory.
      const choices = [...domain].sort(
        (a, b) =>
          rankedInputs.get(a)! - rankedInputs.get(b)! ||
          Number(same(b, preference)) - Number(same(a, preference)) ||
          distance(a) - distance(b),
      );
      for (const value of choices) {
        const branch = clone(domains);
        branch.set(name, new Set([value]));
        const solution = search(branch);
        if (solution) return solution;
        if (exceeded) break;
      }

      return undefined;
    };

    const possible = clone(seed),
      valid = propagate(possible),
      solution = valid ? search(clone(possible)) : undefined;
    const values = new Map<string, string>(),
      options = new Map<string, string[]>();
    if (!solution)
      return {
        values,
        options,
        conflict: exceeded
          ? 'Search limit exceeded'
          : `No valid combination for ${factors.map((f) => f.factor.id).join(', ')}`,
      };
    for (const [name, domain] of solution) values.set(name, [...domain][0]);
    // Check support in the whole coupled component, not just each independent column.
    // The edited variable's menu must still allow the next edit (release its pin).
    for (const [name] of seed) {
      const base = clone(seed);
      if (pinned.has(name))
        base.set(name, new Set(factors.flatMap((f) => f.rows.flatMap((r) => (r.has(name) ? [r.get(name)!] : [])))));
      if (!propagate(base)) {
        options.set(name, []);
        continue;
      }
      const supported: string[] = [];
      for (const value of base.get(name)!) {
        const branch = clone(base);
        branch.set(name, new Set([value]));
        if (search(branch)) supported.push(value);
        if (exceeded) return { values, options, conflict: 'Search limit exceeded' };
      }
      options.set(name, supported);
    }

    return { values, options };
  }
}

import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import {
  flmText,
  SpecificationIndex,
  type FlmEntity,
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
  deferredExpressions?: ConstraintConflict[];
  resolvedValues: Map<string, string>;
  validOptions: Map<string, string[]>;
  // Columns suggested by a Nonrestrictive (TYPE=1, LEVEL>0) table mapping.
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

const inputs = (text: string) =>
  [...text.matchAll(/\b[A-Za-z_][\w.]*(?![\w.]|\s*\()/g)].map((m) => m[0]).filter((v) => v !== 'pi');

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

  return new Map(
    names.flatMap((name, i) => (fields.get('ROLEPARAM' + (i + 1)) ? [[name, fields.get('ROLEPARAM' + (i + 1))!]] : [])),
  );
}

export class CompiledConstraintGraph {
  readonly variables = new Map<string, FlmVariable>();
  readonly factors: ConstraintFactor[] = [];
  readonly edges = new Map<string, Set<string>>();
  readonly groups: DependencyGroup[];
  readonly aliases: Map<string, string>;
  readonly issues: ConstraintConflict[] = [];
  readonly #tables = new Map<string, SpecificationIndex>();

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
        // CND_VARn may reference inline VALUE_SET VALn instead of scalar
        // CND_RELn/CND_VALn. Compile its members as equality alternatives.
        const rule = { ...sourceRule, conditionsRaw: { ...sourceRule.conditionsRaw } };
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
          (b) => ![2, 5, 10].includes(b.bindingTypeCode) && !(b.bindingTypeCode === 1 && b.levelCode > 0),
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
        this.factors.push({ id: `${scope}restriction:${rule.index}`, rule, scope, variables: [...names] });
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
    // Technology size tables constrain only the connectors that explicitly
    // reference them. Different ports share a variable only when the JSON does.
    for (const link of entity.connectors ?? []) {
      const technologyVariable = link.technologyExpression?.startsWith('%')
        ? link.technologyExpression.slice(1)
        : undefined;
      const technologyId = link.technologyRef?.id ?? (!technologyVariable ? link.technologyExpression : undefined);
      if (!technologyVariable && !technologyId) continue;
      const scope = link.variables?.length ? `connector:${link.id}/` : '';
      for (const technology of Object.values(library.technologies)) {
        if (!technologyVariable && technology.id !== technologyId) continue;
        const tables = technology.tableRefs
          .map((guid) => library.specifications[guid])
          .filter((table) => table?.id === technology.sizeTableName);
        if (tables.length !== 1 || !link.diameterExpression) continue; // Resolver reports unsupported referenced schemas.
        const table = tables[0],
          columnKey = table.columns.indexOf('d') >= 0 ? table.columns.indexOf('d') : table.columns.indexOf('Dn_nom');
        if (columnKey < 0) continue;
        const conditions = { ...link.conditionsRaw };
        if (technologyVariable) {
          const index =
            1 +
            Math.max(
              0,
              ...Object.keys(conditions)
                .filter((key) => /^CND_VAR\d*$/.test(key))
                .map((key) => Number(key.slice(7) || '1')),
            );
          conditions[`CND_VAR${index}`] = technologyVariable;
          conditions[`CND_REL${index}`] = 3;
          conditions[`CND_VAL${index}`] = technology.id;
        }
        const target = scope + link.diameterExpression;
        this.factors.push({
          id: `connector:${link.id}/technology:${technology.guid}`,
          scope,
          variables: [target],
          rule: {
            index: -1,
            typeCode: 1,
            tableGuid: table.guid,
            conditionsRaw: conditions,
            extraFields: [],
            bindings: [{ variable: link.diameterExpression, columnKey, bindingTypeCode: 1, levelCode: 0 }],
          },
        });
        for (const [field, expression] of Object.entries(conditions))
          if (field.startsWith('CND_VAR')) {
            for (const name of inputs(String(expression))) {
              const key = scope + name,
                edges = this.edges.get(key) ?? new Set();
              edges.add(target);
              this.edges.set(key, edges);
            }
          }
      }
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
      groups.push({ id: `group:${groups.length}`, variables, dependencies: [] });
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
    { key: string; values: Map<string, string>; options: Map<string, string[]>; conflict?: string }
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
    for (const [name, variable] of graph.variables) {
      const explicit = variable.options.map((o) => flmText(o.value)).filter((v): v is string => v !== undefined);
      if (explicit.length) options.set(name, [...new Set(explicit)]);
    }
    // Re-resolving an existing snapshot is not an edit. Only a fresh graph
    // initialization or explicitly changed inputs may trigger LEVEL>0 defaults.
    // Otherwise a valid editable l4=25 is silently reset to the table's l4=32.
    const touched = new Set(changed.length ? changed : previous.size ? [] : graph.variables.keys());
    for (const name of touched) for (const next of graph.edges.get(name) ?? []) touched.add(next);
    // Formula outputs must be recomputed after their inputs change; old values
    // are preferences for table selection, never pins.

    const limit = (factor: ConstraintFactor, report: boolean): void => {
      const context = graph.context(values, factor.scope);
      for (const node of factor.rule.extraFields) {
        if (node.tag !== 'LIMIT') {
          if (report) addIssue('UNSUPPORTED_RESTRICTION', `Unsupported ${node.tag}`, factor.id);
          continue;
        }
        const a = node.attributes,
          name = factor.scope + a.NAME;
        const relation = Number(a.RELATION),
          formula = a.TYPE === '1';
        if (![0, 1, 2, 3].includes(relation) || !['0', '1'].includes(a.TYPE)) {
          if (report) addIssue('UNSUPPORTED_RESTRICTION', `Unsupported limit codes ${a.TYPE}/${a.RELATION}`, factor.id);
          continue;
        }
        const expression = a.EXPRESSION ?? node.children.find((child) => child.tag === 'VALUE')?.text ?? '';
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
          // An equality LIMIT is authoritative, even when the variable already
          // has a default or a value carried over from an earlier table row.
          // Re-evaluate on *every* solve pass: another factor may change an
          // upstream value without the caller explicitly marking it changed.
          // Explicit edits remain pins and must be validated, not overwritten.
          if (!report && !pinned.has(name) && !same(current, expected)) values.set(name, expected);
          if (report && !same(values.get(name), expected))
            addIssue('LIMIT_CONFLICT', `${a.NAME} must equal ${expected}`, factor.id);
          continue;
        }
        if (
          current === undefined ||
          (relation === 1 ? Number(current) < Number(expected) : Number(current) > Number(expected))
        ) {
          if (pinned.has(name) && report)
            addIssue('LIMIT_CONFLICT', `${a.NAME} must be ${relation === 1 ? '>=' : '<='} ${expected}`, factor.id);
          else if (!report && !pinned.has(name)) values.set(name, expected);
          else if (report) addIssue('LIMIT_CONFLICT', `${a.NAME} is not resolved within its bounds`, factor.id);
        }
      }
    };

    let stable = false;
    let lastTables: TupleFactor[] = [];
    const visited = new Set<string>();
    for (let pass = 0; pass <= graph.factors.length + 2; ++pass) {
      const before = JSON.stringify([...values].sort());
      if (visited.has(before)) {
        addIssue('NON_CONVERGENT', 'Restrictions do not converge');
        break;
      }
      visited.add(before);
      conflicts.splice(0, conflicts.length, ...graph.issues);
      initializeDefaults();
      // Derived outputs whose producers are all inactive have no value in this
      // configuration. Clear previous-branch results, and propagate absence so
      // downstream numeric conditions do not activate or report missing inputs.
      const producers = new Map<string, ConstraintFactor[]>();
      for (const factor of graph.factors) {
        const outputs = [
          ...factor.rule.bindings.filter((b) => [2, 5, 10].includes(b.bindingTypeCode)).map((b) => b.variable),
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
          // TYPE 7/9 are not documented in the supplied FLM schema. Only an
          // EXACT numeric/text row match is unambiguous; never guess the nearest
          // size, round an input or turn the expression into an output.
          // TYPE 8 is a table input. Its numeric breakpoint tables use the
          // smallest value >= the input (within the table bounds).
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
            let matching = table.matching(binding.columnKey, result);
            if ((code === 7 || code === 9) && matching.size === 0)
              throw new Error(`Unsupported DEF_ARGMAP TYPE ${code}: no exact row for ${binding.variable}=${result}`);
            if (code === 8 && matching.size === 0) {
              const source = Number(result);
              const column = table.columns[binding.columnKey];
              const numeric = column?.map((cell) => (cell === undefined ? Number.NaN : Number(cell)));
              const available = numeric?.filter(Number.isFinite) ?? [];
              const ascending = available.every((n, i) => i === 0 || n >= available[i - 1]);
              const descending = available.every((n, i) => i === 0 || n <= available[i - 1]);
              if (
                !result.trim() ||
                !Number.isFinite(source) ||
                !numeric ||
                available.length !== column!.length ||
                (!ascending && !descending)
              )
                throw new Error(`Unsupported TYPE 8 numeric breakpoint table for ${binding.variable}`);
              if (source < Math.min(...available) || source > Math.max(...available))
                throw new Error(`TYPE 8 lookup outside table bounds: ${binding.variable}=${result}`);
              const upper = available.filter((n) => n >= source);
              matching = table.matching(binding.columnKey, String(Math.min(...upper)));
            }
            selectorRows.set(binding, matching);
            candidates = candidates.filter((index) => matching.has(index));
          }
          for (const rowIndex of candidates) {
            const row = new Map<string, string>(),
              suggested = new Map<string, string>();
            let accept = true;
            for (const b of factor.rule.bindings) {
              const cells = table.columns[b.columnKey];
              if (!cells) throw new Error(`Missing column ${b.columnKey}`);
              const cell = cells[rowIndex];
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
                if (row.has(name) && !same(row.get(name), cell)) accept = false;
                // LEVEL>0 lists suggest editable dependent dimensions, not a
                // separate relation that overrides explicit min/max restrictions.
                if (
                  (b.bindingTypeCode === 1 && b.levelCode > 0) ||
                  (b.bindingTypeCode === 2 &&
                    suggestedColumns.has(
                      JSON.stringify([factor.scope, factor.rule.tableGuid, b.columnKey, b.variable]),
                    ))
                )
                  suggested.set(name, cell);
                else {
                  row.set(name, cell);
                  const variable = graph.variables.get(name);
                  if (variable?.options.length && !variable.options.some((o) => same(flmText(o.value), cell)))
                    accept = false;
                  if (variable && variable.valueTypeCode !== 3) {
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
            }
            if (accept) {
              rows.push(row);
              defaults.push(suggested);
              rowIds.push(rowIndex);
            }
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
          component.map((f) => [f.factor.id, f.rowIds]),
          [...names].map((n) => [n, values.get(n), pinned.has(n)]),
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
          const row = tuple.rows.findIndex((r) => [...r].every(([name, v]) => same(values.get(name), v)));
          if (row < 0) continue;
          for (const [name, suggestion] of tuple.defaults[row]) {
            if (!options.has(name))
              options.set(name, [
                ...new Set(tuple.defaults.map((d) => d.get(name)).filter((v): v is string => v !== undefined)),
              ]);
            if (
              !pinned.has(name) &&
              (!values.has(name) || (pass === 0 && [...tuple.rows[row].keys()].some((v) => touched.has(v))))
            )
              values.set(name, suggestion);
          }
        }
      }
      for (const factor of graph.factors)
        if (active.has(factor.id) && factor.rule.typeCode === 2 && !factor.rule.tableGuid) limit(factor, false);
      lastTables = tables;
      if (before === JSON.stringify([...values].sort())) {
        stable = true;
        break;
      }
      const earlier = new Map<string, string>(JSON.parse(before));
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
      else if (variable.valueTypeCode !== 3 && (!value.trim() || !Number.isFinite(Number(value))))
        addIssue('TYPE_CONFLICT', `Invalid number: ${name}=${value}`);
      const min = flmText(variable.properties.MIN_VALUE),
        max = flmText(variable.properties.MAX_VALUE);
      // In this FLM dialect MAX_VALUE=0 denotes an unspecified upper bound.
      if (
        variable.valueTypeCode !== 3 &&
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
    for (const factor of graph.factors) {
      if (!active.has(factor.id)) continue;
      for (const binding of factor.rule.bindings) {
        if (binding.bindingTypeCode !== 1 || binding.levelCode <= 0 || !identifier.test(binding.variable)) continue;
        nonrestrictiveParameters.add(
          factor.scope + (!factor.scope ? (graph.aliases.get(binding.variable) ?? binding.variable) : binding.variable),
        );
      }
    }

    return {
      resolvedValues: values,
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
      const choices = [...domain].sort(
        (a, b) => Number(same(b, preferences.get(name))) - Number(same(a, preferences.get(name))),
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

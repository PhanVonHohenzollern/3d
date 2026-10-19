import { cppLanguage } from '@codemirror/lang-cpp';

// Expand object macros as tokens, preserving C preprocessor precedence. Never execute source code.
function constantIndex(expression: string, macros: ReadonlyMap<string, string>): number {
  function expand(value: string, stack = new Set<string>()): string {
    return value.replace(/\b[A-Za-z_]\w*\b/g, (name) => {
      const replacement = macros.get(name);
      if (replacement === undefined || stack.has(name)) throw new Error(`Unresolved registry constant: ${name}`);

      return expand(replacement, new Set([...stack, name]));
    });
  }

  const source = expand(expression).replace(/\s+/g, '');
  const tokens = source.match(/\d+|[()+\-*/%]/g) ?? [];
  if (tokens.join('') !== source) throw new Error(`Unsupported registry index: ${expression}`);
  let position = 0;

  function atom(): number {
    const token = tokens[position++];
    if (token === '+') return atom();
    if (token === '-') return -atom();
    if (token === '(') {
      const value = sum();
      if (tokens[position++] !== ')') throw new Error(`Invalid registry index: ${expression}`);

      return value;
    }
    if (!token || !/^\d+$/.test(token)) throw new Error(`Invalid registry index: ${expression}`);

    return Number(token);
  }

  function product(): number {
    let value = atom();
    while (['*', '/', '%'].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = atom();
      value = operator === '*' ? value * right : operator === '/' ? Math.trunc(value / right) : value % right;
    }

    return value;
  }

  function sum(): number {
    let value = product();
    while (['+', '-'].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = product();
      value += operator === '+' ? right : -right;
    }

    return value;
  }

  const value = sum();
  if (position !== tokens.length || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid registry index: ${expression}`);

  return value;
}

export function geometryRegistry(code: string): Map<string, string> {
  const clean = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, (text) =>
    text.startsWith('/') ? text.replace(/[^\r\n]/g, ' ') : text,
  );
  const registry = new Map<string, string>();

  function register(block: string, entry: string): void {
    if (registry.has(block)) throw new Error(`Duplicate geometry registration: ${block}`);
    registry.set(block, entry);
  }

  const names = clean.match(/\b__GEO_NAME\s*\[[^\]]*\]\s*=\s*\{([^}]+)\}/)?.[1];
  const functions = clean.match(/\b__GEO_FN\s*\[[^\]]*\]\s*=\s*\{([^}]+)\}/)?.[1];
  if (names || functions) {
    if (!names || !functions) throw new Error('Incomplete __GEO_NAME / __GEO_FN registry');
    const blocks = [...names.matchAll(/"([^"\\]+)"/g)].map((m) => m[1]);
    const entries = [...functions.matchAll(/&(?:\w+\s*::\s*)*(\w+)\s*(?=,|$)/g)].map((m) => m[1]);
    if (blocks.length !== entries.length || !blocks.length) throw new Error('Geometry registration arrays differ');
    blocks.forEach((block, i) => register(block, entries[i]));
  }

  const legacyNames = clean.match(/\bFN_NAME\s*\[([^\]]*)\]\s*=\s*\{([^}]+)\}/);
  if (!legacyNames) return registry;
  const blocks = [...legacyNames[2].matchAll(/"([^"\\]+)"/g)].map((m) => m[1]);
  if (!blocks.length || new Set(blocks).size !== blocks.length) throw new Error('Empty or duplicate FN_NAME entries');
  const macros = new Map<string, string>();
  for (const match of clean.replace(/\\\r?\n/g, ' ').matchAll(/^[\t ]*#\s*define\s+(\w+)[\t ]+([^\r\n]+)/gm))
    macros.set(match[1], match[2]);
  if (legacyNames[1].trim() && constantIndex(legacyNames[1], macros) !== blocks.length)
    throw new Error('FN_NAME size differs from its initialized entries');

  const masked = clean.replace(/^[\t ]*#(?:[^\r\n]*\\\r?\n)*[^\r\n]*/gm, (text) => text.replace(/[^\r\n]/g, ' '));
  const tree = cppLanguage.parser.parse(masked);
  let dispatchers = 0;
  tree.iterate({
    enter(cursor) {
      if (cursor.name !== 'FunctionDefinition') return;
      const node = cursor.node;
      const body = clean.slice(node.from, node.to);
      // Bind the switch variable to the actual index used in the name comparison.
      const lookup = body.match(
        /!\s*strcmp\s*\(\s*\w+\s*,\s*FN_NAME\s*\[\s*(\w+)\s*\]\s*\)\s*\)\s*\{\s*(\w+)\s*=\s*(\w+)\s*;/,
      );
      if (!lookup || lookup[1] !== lookup[3]) return false;
      const entries = new Map<number, string>();
      let switches = 0;
      tree.iterate({
        from: node.from,
        to: node.to,
        enter(item) {
          if (item.name !== 'SwitchStatement') return;
          const condition = item.node.getChild('ConditionClause');
          if (!condition || clean.slice(condition.from, condition.to).replace(/[\s()]/g, '') !== lookup[2])
            return false;
          switches++;
          const cases = item.node.getChild('CompoundStatement')?.getChildren('CaseStatement') ?? [];
          for (const branch of cases) {
            const text = clean.slice(branch.from, branch.to).trim();
            if (text.startsWith('default')) continue;
            // A registry branch must dispatch exactly one no-argument creator, then terminate.
            const match = text.match(
              /^case\s+([^:]+):\s*(?:\w+\s*=\s*|return\s+)?\w+\s*(?:\.|->)\s*(\w+)\s*\(\s*\)\s*;\s*(?:break\s*;)?\s*$/,
            );
            if (!match || (!/^case[^:]+:\s*return\b/.test(text) && !/break\s*;\s*$/.test(text)))
              throw new Error(`Unsupported geometry dispatch branch: ${text.slice(0, 120)}`);
            const index = constantIndex(match[1], macros);
            if (index >= blocks.length || entries.has(index))
              throw new Error(`Duplicate or out-of-range geometry index: ${index}`);
            entries.set(index, match[2]);
          }

          return false;
        },
      });
      if (switches !== 1 || entries.size !== blocks.length)
        throw new Error('FN_NAME dispatcher is incomplete or ambiguous');
      dispatchers++;
      for (const [index, entry] of entries) register(blocks[index], entry);

      return false;
    },
  });
  if (dispatchers !== 1) throw new Error('Cannot identify a unique FN_NAME dispatcher');

  return registry;
}

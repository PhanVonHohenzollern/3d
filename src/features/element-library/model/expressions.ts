// Verified against FLM3Sys.frx: GetRectRad (RVA 0xE2950), GetCircRad
// (0xE2BC0), and the default tables in getRectRadii/getCircRadii
// (0xE0AF0/0xE1440). Native FLM uses site settings; this standalone
// evaluator uses its built-in defaults. Bounds are inclusive, with the
// final row covering dimensions above the largest finite bound.
// Rectangular values are radii in mm; circular values are r/d ratios.
const defaultRectRadii: readonly (readonly [number, number])[] = [
  [1000, 100],
  [2000, 150],
  [Infinity, 200],
];
const defaultCircRadii: readonly (readonly [number, number])[] = [
  [600, 0.8],
  [1250, 1],
  [Infinity, 1.5],
];

function radiusLookup(
  name: string,
  rows: readonly (readonly [number, number])[],
  args: readonly number[],
): number {
  if (args.length !== 1 || !Number.isFinite(args[0]))
    throw new Error(`${name} requires one finite dimension`);

  return rows.find(([upperBound]) => args[0] <= upperBound)![1];
}

const functions: Record<string, (...values: number[]) => number> = {
  rect_rad: (...args) => radiusLookup('rect_rad', defaultRectRadii, args),
  circ_rad: (...args) => radiusLookup('circ_rad', defaultCircRadii, args),
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  // FLM's unary mod(x) is the absolute magnitude of a scalar (not x % y).
  mod: Math.abs,
  sqrt: Math.sqrt,
  pow: Math.pow,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  exp: Math.exp,
  log: Math.log,
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  cot: (x) => 1 / Math.tan((x * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
};

/**
 * Legacy FLM LIMIT strings sometimes have an unmatched parenthesis only at
 * the very end (General/RS, US, TR3*). Completing a trailing group, or removing
 * a redundant final close, does not change operator order. Never repair a
 * mismatch in the middle of a formula or invent a missing operand.
 */
export function normalizeFinalParentheses(tokens: readonly string[]): string[] {
  const opens: string[] = [];
  let trailingCloses = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '(' || token === '[') {
      if (trailingCloses) return [...tokens];
      opens.push(token);
    } else if (token === ')' || token === ']') {
      const expected = opens.at(-1) === '(' ? ')' : opens.at(-1) === '[' ? ']' : undefined;
      if (expected === token) opens.pop();
      else if (!opens.length && token === ')' && tokens.slice(i).every((t) => t === ')'))
        trailingCloses++;
      else return [...tokens];
    }
  }
  if (trailingCloses) return tokens.slice(0, -trailingCloses);
  // A trailing parenthesis can be closed without changing existing precedence.
  if (opens.some((o) => o !== '(')) return [...tokens];

  return [...tokens, ...opens.map(() => ')')];
}

export function evaluateLibraryExpression(expression: string, values: ReadonlyMap<string, string>): number {
  if (values.has(expression)) {
    const source = values.get(expression)!;
    const value = Number(source);
    if (!source.trim() || !Number.isFinite(value)) throw new Error(`Invalid number: ${expression}`);

    return value;
  }
  const tokens = normalizeFinalParentheses(expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z_][\w.]*|\S/gi) ?? []);
  let position = 0;

  function atom(): number {
    const token = tokens[position++];
    if (token === '(' || token === '[') {
      const result = binary(0);
      const closing = token === '(' ? ')' : ']';
      if (tokens[position++] !== closing) throw new Error(`Expected '${closing}': ${expression}`);

      return result;
    }
    if (tokens[position] === '(' && Object.hasOwn(functions, token)) {
      ++position;
      const args: number[] = [];
      do {
        args.push(binary(0));
        if (tokens[position] !== ',') break;
        ++position;
      } while (position < tokens.length);
      if (tokens[position++] !== ')') throw new Error(`Expected ')': ${expression}`);

      return functions[token](...args);
    }
    if (token === 'pi') return Math.PI;
    if (tokens[position] === '(')
      throw new Error(`Unsupported FLM function: ${token} in ${expression}`);
    const source = values.get(token) ?? token;
    const value = Number(source);
    if (!source?.trim() || !Number.isFinite(value)) throw new Error(`Missing or invalid value: ${token ?? expression}`);

    return value;
  }

  // Unary signs bind more tightly than multiplication but not exponentiation:
  // -2^2 = -(2^2), and 2^-2 = 1/4. Exponentiation is right associative.
  function unary(): number {
    if (tokens[position] === '+') {
      ++position;

      return unary();
    }
    if (tokens[position] === '-') {
      ++position;

      return -unary();
    }
    const base = atom();
    if (tokens[position] === '^') {
      ++position;

      return base ** unary();
    }

    return base;
  }

  function binary(minimum: number): number {
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
    let result = unary();
    while ((precedence[tokens[position]] ?? -1) >= minimum) {
      const operator = tokens[position++];
      const right = binary(precedence[operator] + 1);
      switch (operator) {
        case '+':
          result += right;
          break;
        case '-':
          result -= right;
          break;
        case '*':
          result *= right;
          break;
        case '/':
          result /= right;
          break;
      }
    }

    return result;
  }

  const result = binary(0);
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error(`Invalid expression: ${expression}`);

  return result;
}

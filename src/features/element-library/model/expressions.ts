const functions: Record<string, (...values: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
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
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
};

export function evaluateLibraryExpression(expression: string, values: ReadonlyMap<string, string>): number {
  if (values.has(expression)) {
    const source = values.get(expression)!;
    const value = Number(source);
    if (!source.trim() || !Number.isFinite(value)) throw new Error(`Invalid number: ${expression}`);

    return value;
  }
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z_][\w.]*|\S/gi) ?? [];
  let position = 0;

  function atom(): number {
    const token = tokens[position++];
    if (token === '+') return binary(3);
    if (token === '-') return -binary(3);
    if (token === '(') {
      const result = binary(0);
      if (tokens[position++] !== ')') throw new Error(`Expected ')': ${expression}`);

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
    const source = values.get(token) ?? token;
    const value = Number(source);
    if (!source?.trim() || !Number.isFinite(value)) throw new Error(`Missing or invalid value: ${token ?? expression}`);

    return value;
  }

  function binary(minimum: number): number {
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
    let result = atom();
    while ((precedence[tokens[position]] ?? -1) >= minimum) {
      const operator = tokens[position++];
      const right = binary(precedence[operator] + (operator === '^' ? 0 : 1));
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
        case '^':
          result **= right;
          break;
      }
    }

    return result;
  }

  const result = binary(0);
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error(`Invalid expression: ${expression}`);

  return result;
}

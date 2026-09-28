import { doubleToInt64 } from '@engine/runtime/cpp/cpp';
import { FdPoint3d, FdVector3d } from '@engine/runtime/FdMath';
import {
  balancedEnd,
  isIdentifier,
  isSymbol,
  parseCallArguments,
  TokKind,
  type Token,
} from '@engine/runtime/helpers/tokens';
import { isNumericType, parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { parsePathSteps } from '@engine/runtime/interpreter/paths';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';

// The expression tree. Expressions are parsed once (see parseExpression's cache) and evaluated by
// evaluator.ts. A syntax error becomes an `error` node where the parse failed, so evaluation runs
// everything before it first, as the old parse-and-evaluate interpreter did. `failure` is set on
// every node above one, so even a skipped branch (a false `&&` operand) reports it.

export type PostfixStep =
  | { kind: 'index'; index: Expr; source: Token[] }
  | { kind: 'member'; name: string; source: Token[] }
  | { kind: 'method'; name: string; args: Expr[]; line: number; source: Token[] };

export type Expr = { failure: string | undefined } & (
  | { kind: 'literal'; value: RuntimeValue }
  | { kind: 'constant'; make: () => RuntimeValue }
  | { kind: 'name'; name: string; token: Token }
  | { kind: 'scoped'; name: string }
  | { kind: 'call'; name: string; argGroups: Token[][]; line: number }
  | { kind: 'unary'; op: string; operand: Expr }
  | { kind: 'cast'; type: string; operand: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'logical'; op: '&&' | '||'; left: Expr; right: Expr }
  | { kind: 'conditional'; condition: Expr; yes: Expr; no: Expr }
  | { kind: 'sequence'; items: Expr[] }
  | { kind: 'new'; type: string; dims: Expr[] }
  | { kind: 'postfix'; base: Expr; steps: PostfixStep[] }
  | { kind: 'error'; message: string }
);

type Shape = Expr extends infer E ? (E extends Expr ? Omit<E, 'failure'> : never) : never;

function node(shape: Shape, ...children: readonly (Expr | undefined)[]): Expr {
  const failure = shape.kind === 'error' ? shape.message : children.find((child) => child?.failure)?.failure;

  return { ...shape, failure } as Expr;
}

const kScopedConstants: ReadonlyMap<string, () => RuntimeValue> = new Map<string, () => RuntimeValue>([
  ['FdVector3d::kXAxis', () => new FdVector3d(1, 0, 0)],
  ['FdVector3d::kYAxis', () => new FdVector3d(0, 1, 0)],
  ['FdVector3d::kZAxis', () => new FdVector3d(0, 0, 1)],
  ['FdVector3d::kIdentity', () => new FdVector3d(0, 0, 0)],
  ['FdPoint3d::kOrigin', () => new FdPoint3d()],
]);

const kBinaryLevels: readonly (readonly string[])[] = [
  ['|'],
  ['^'],
  ['&'],
  ['==', '!='],
  ['<', '>', '<=', '>='],
  ['<<', '>>'],
  ['+', '-'],
  ['*', '/', '%'],
];

const kCache = new WeakMap<readonly Token[], Expr | null>();

// The tree for an expression (null for no tokens), parsed once per token array.
export function parseExpression(tokens: readonly Token[]): Expr | null {
  let tree = kCache.get(tokens);
  if (tree === undefined) {
    tree = tokens.length === 0 ? null : new ExpressionParser(tokens).parse();
    kCache.set(tokens, tree);
  }

  return tree;
}

function numberLiteral(token: Token): RuntimeValue {
  const text = token.text;
  const hex = text.length >= 2 && text[0] === '0' && (text[1] === 'x' || text[1] === 'X');
  const exponentChars = hex ? '.pP' : '.eEfF';

  return [...text].some((ch) => exponentChars.includes(ch)) ? token.number : doubleToInt64(token.number);
}

class ExpressionParser {
  #pos = 0;
  #failed = false;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): Expr {
    const tree = this.#conditional();
    if (this.#failed || this.#atEnd()) return tree;

    return node(
      { kind: 'sequence', items: [tree, this.#fail('unexpected token in expression: ' + this.#current()?.text)] },
      tree,
    );
  }

  #atEnd(): boolean {
    return this.#pos >= this.tokens.length;
  }

  #current(offset = 0): Token | undefined {
    return this.tokens[this.#pos + offset];
  }

  #currentIs(...texts: string[]): boolean {
    return !this.#atEnd() && texts.includes(this.tokens[this.#pos].text);
  }

  #match(text: string): boolean {
    if (this.#failed || !this.#currentIs(text)) return false;
    ++this.#pos;

    return true;
  }

  // A syntax error: parsing stops here and the node throws `message` when evaluation reaches it.
  #fail(message: string): Expr {
    this.#failed = true;

    return node({ kind: 'error', message });
  }

  // Null when the token is there; otherwise the error to put in its place.
  #expect(text: string): Expr | null {
    if (this.#failed) return null;

    return this.#match(text) ? null : this.#fail(`expected '${text}'`);
  }

  #conditional(): Expr {
    const condition = this.#logical('||');
    if (!this.#match('?')) return condition;
    const yes = this.#conditional();
    const colon = this.#expect(':');
    const no = colon ?? (this.#failed ? node({ kind: 'literal', value: undefined }) : this.#conditional());

    return node({ kind: 'conditional', condition, yes, no }, condition, yes, no);
  }

  #logical(op: '&&' | '||'): Expr {
    let left = op === '||' ? this.#logical('&&') : this.#binary(0);
    while (this.#match(op)) {
      const right = op === '||' ? this.#logical('&&') : this.#binary(0);
      left = node({ kind: 'logical', op, left, right }, left, right);
    }

    return left;
  }

  #binary(level: number): Expr {
    if (level >= kBinaryLevels.length) return this.#unary();
    let left = this.#binary(level + 1);
    while (!this.#failed && this.#currentIs(...kBinaryLevels[level])) {
      const op = this.tokens[this.#pos++].text;
      const right = this.#binary(level + 1);
      left = node({ kind: 'binary', op, left, right }, left, right);
    }

    return left;
  }

  #unary(): Expr {
    for (const op of ['!', '-', '~', '+'])
      if (this.#match(op)) {
        const operand = this.#unary();

        return op === '+' ? operand : node({ kind: 'unary', op, operand }, operand);
      }
    const token = this.#current();
    if (token && isIdentifier(token, 'static_cast')) return this.#staticCast();
    const cast = this.#castAhead();
    if (cast) {
      this.#pos = cast.end + 1;
      const operand = this.#unary();

      return node({ kind: 'cast', type: cast.type, operand }, operand);
    }

    return this.#primary();
  }

  #castAhead(): { type: string; end: number } | null {
    if (!this.#currentIs('(')) return null;
    const parsed = parseRuntimeType(this.tokens, this.#pos + 1);
    if (!parsed || !isNumericType(parsed.type)) return null;

    return parsed.end < this.tokens.length && isSymbol(this.tokens[parsed.end], ')') ? parsed : null;
  }

  #staticCast(): Expr {
    ++this.#pos;
    const open = this.#expect('<');
    if (open) return open;
    const parsed = parseRuntimeType(this.tokens, this.#pos);
    if (!parsed || !isNumericType(parsed.type)) return this.#fail('unsupported static_cast type');
    this.#pos = parsed.end;
    const close = this.#expect('>') ?? this.#expect('(');
    if (close) return close;
    const operand = this.#conditional();
    const end = this.#expect(')');
    const cast = node({ kind: 'cast', type: parsed.type, operand }, operand);

    return end ? node({ kind: 'sequence', items: [cast, end] }, cast, end) : cast;
  }

  #primary(): Expr {
    const token = this.#current();
    if (!token) return this.#fail('expected expression');
    if (token.kind === TokKind.Number) {
      ++this.#pos;

      return node({ kind: 'literal', value: numberLiteral(token) });
    }
    if (token.kind === TokKind.String) {
      ++this.#pos;

      return node({ kind: 'literal', value: token.character ? BigInt(token.text.charCodeAt(0)) : token.text });
    }
    if (this.#match('(')) {
      const items = [this.#conditional()];
      while (this.#match(',')) items.push(this.#conditional());
      const close = this.#expect(')');
      if (close) items.push(close);
      const sequence = node({ kind: 'sequence', items }, ...items);

      return this.#failed ? sequence : this.#postfix(sequence);
    }
    if (token.kind !== TokKind.Identifier) return this.#fail("expected expression near '" + token.text + "'");
    const name = token.text;
    ++this.#pos;
    if (name === 'true' || name === 'false') return node({ kind: 'literal', value: name === 'true' });
    if (name === 'NULL' || name === 'nullptr') return node({ kind: 'literal', value: undefined });
    if (name === 'new') return this.#allocation();
    if (this.#match('::')) return this.#scoped(name);
    if (this.#currentIs('(')) return this.#postfix(this.#call(name, token.line));

    return this.#postfix(node({ kind: 'name', name, token }));
  }

  #allocation(): Expr {
    const parsed = parseRuntimeType(this.tokens, this.#pos);
    if (!parsed) return this.#fail('expected allocated type after new');
    this.#pos = parsed.end;
    const dims: Expr[] = [];
    while (this.#match('[')) {
      dims.push(this.#conditional());
      const close = this.#expect(']');
      if (close) dims.push(close);
    }
    if (this.#failed) return node({ kind: 'new', type: parsed.type, dims }, ...dims);
    if (dims.length === 0) return this.#fail('only array allocation is supported');
    if (this.#match('(')) {
      const close = this.#expect(')');
      if (close) dims.push(close);
    }
    if (this.#match('{')) {
      const close = this.#expect('}');
      if (close) dims.push(close);
    }

    return node({ kind: 'new', type: parsed.type, dims }, ...dims);
  }

  // A named call, or a program/SDK call whose arguments stay unparsed for the executor.
  #call(name: string, line: number): Expr {
    const close = balancedEnd(this.tokens, this.#pos);
    const argGroups = parseCallArguments(this.tokens, this.#pos);
    if (close >= this.tokens.length) {
      this.#pos = this.tokens.length;

      return this.#fail("expected ')' after arguments");
    }
    this.#pos = close + 1;

    return node({ kind: 'call', name, argGroups, line });
  }

  #scoped(name: string): Expr {
    const first = this.#current();
    if (!first || first.kind !== TokKind.Identifier) return this.#fail('expected name after ::');
    let qualified = name + '::' + first.text;
    ++this.#pos;
    const constant = kScopedConstants.get(qualified);
    if (constant) return node({ kind: 'constant', make: constant });
    while (this.#match('::')) {
      const part = this.#current();
      if (!part || part.kind !== TokKind.Identifier) return this.#fail('expected scoped name');
      qualified += '::' + part.text;
      ++this.#pos;
    }
    const token = this.#current();
    if (token && isSymbol(token, '('))
      return this.#call(qualified.startsWith('std::') ? qualified.slice(5) : qualified, token.line);

    return this.#postfix(node({ kind: 'scoped', name: qualified }));
  }

  #postfix(base: Expr): Expr {
    if (this.#failed) return base;
    const path = parsePathSteps(this.tokens, this.#pos);
    const steps: PostfixStep[] = [];
    const children: Expr[] = [base];
    let error: Expr | null = null;
    for (const step of path.steps) {
      if (step.kind === 'member') {
        steps.push({ kind: 'member', name: step.name, source: step.source });
        continue;
      }
      if (step.kind === 'index') {
        const index = parseExpression(step.tokens) ?? node({ kind: 'error', message: 'expected expression' });
        children.push(index);
        steps.push({ kind: 'index', index, source: step.source });
        if (!step.closed) error = node({ kind: 'error', message: "expected ']'" });
      } else {
        const args = step.args.map(
          (group) => parseExpression(group) ?? node({ kind: 'error', message: 'expected expression' }),
        );
        children.push(...args);
        steps.push({ kind: 'method', name: step.name, args, line: step.source[0].line, source: step.source });
        if (!step.closed) error = node({ kind: 'error', message: "expected ')'" });
      }
      if (error || children.at(-1)?.failure !== undefined) break;
    }
    this.#pos = path.end;
    if (path.error) error ??= node({ kind: 'error', message: path.error });
    if (error) {
      this.#failed = true;
      children.push(error);
    }
    const chain = steps.length ? node({ kind: 'postfix', base, steps }, ...children) : base;
    if (error) return node({ kind: 'sequence', items: [chain, error] }, chain, error);
    if (children.some((child) => child.failure !== undefined)) this.#failed = true;

    return chain;
  }
}

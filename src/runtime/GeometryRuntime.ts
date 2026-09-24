// Port of runtime/GeometryRuntime.{h,cpp}: the C++-subset interpreter.
//
// Lexer -> ProgramParser (statements) -> ExprParser (expressions) ->
// RuntimeExecutor, in the same order and with the same method names as the
// C++ file so the two can be diffed side by side.
//
// Porting notes (C++ -> TypeScript):
// - RuntimeValue: see RuntimeValue.ts (monostate = undefined, int64 = bigint,
//   double = number). A Map<string, RuntimeValue> therefore needs has() for
//   existence checks, because an unset value is stored as undefined.
// - FdPoint3d/FdVector3d are immutable; where C++ mutates one through a
//   RuntimeValue* the port computes the new value and stores it through an
//   l-value slot (MapSlot/ArraySlot stand in for the RuntimeValue* pointer).
// - RuntimeArray is a shared reference like RuntimeArrayPtr. Copies of the
//   whole value map (executeUserFunction) share arrays exactly as the copied
//   std::unordered_map shares its shared_ptrs; runtimeDeepCopy is used exactly
//   where the C++ deep-copies.
// - std::runtime_error(msg) -> CppException('runtime_error', msg). The C++
//   catch clauses only see std::exception; any other JavaScript error is a
//   porting bug and is rethrown instead of becoming a diagnostic.
// - The ExprParser/RuntimeExecutor friends of GeometryRuntime access its
//   m_* members, which are therefore public but marked @internal.

import { apiSignatureMetadataForCall } from './ApiMetadata';
import {
  CppException,
  doubleToInt64,
  isalnum,
  isalpha,
  isdigit,
  isspace,
  stod,
  stoll,
  strtod,
  wrapInt64,
} from './CppCompat';
import { FdPoint3d, FdVector3d } from './FdMath';
import {
  emptyApiCall,
  type RuntimeApiCall,
  type RuntimeArgumentTrace,
  type RuntimeDiagnostic,
  type RuntimeParameterRequest,
  type RuntimeResult,
  type RuntimeValueSource,
  type RuntimeVariableChange,
} from './RuntimeTypes';
import {
  RuntimeArray,
  isArray,
  isBool,
  isDouble,
  isInt,
  isPoint,
  isString,
  isVector,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeDefaultValueForType,
  runtimeInteger,
  runtimeNumber,
  runtimeTruthy,
  runtimeTypeName,
  runtimeValueToCompactString,
  type RuntimeValue,
} from './RuntimeValue';
import { kSdkConstants, sdkCanonicalType, sdkTypeDefinition } from './SdkDefinitions';

export type * from './RuntimeTypes';

/** A C++ reference/out parameter (`std::size_t &pos`, `std::string &op`). */
interface Ref<T> {
  value: T;
}

/**
 * throw std::runtime_error(message). These exceptions are ordinary control
 * flow that ends as a diagnostic (a runaway loop can raise one per
 * iteration), so no JavaScript stack trace is captured for them.
 */
function runtimeError(message: string): CppException {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 0;
  try {
    return new CppException('runtime_error', message);
  } finally {
    Error.stackTraceLimit = limit;
  }
}

/**
 * catch (const std::exception &e) / catch (...): every C++ exception of the
 * original is a CppException here. Anything else is a JavaScript error of the
 * port itself and must not be turned into a diagnostic.
 */
function stdException(e: unknown): CppException {
  if (e instanceof CppException) return e;
  throw e;
}

/** std::round: halfway cases away from zero. */
const cppRound = (x: number): number => (x < 0 ? -Math.round(-x) : Math.round(x));

/** std::pow, including the C99 special cases where Math.pow returns NaN. */
function cppPow(x: number, y: number): number {
  if (x === 1 || y === 0) return 1;
  if (x === -1 && (y === Infinity || y === -Infinity)) return 1;
  return Math.pow(x, y);
}

function trim(s: string): string {
  let begin = 0;
  let end = s.length;
  while (begin < end && isspace(s[begin])) ++begin;
  while (end > begin && isspace(s[end - 1])) --end;
  return s.slice(begin, end);
}

const TokKind = { Identifier: 0, Number: 1, String: 2, Symbol: 3, End: 4 } as const;
type TokKind = (typeof TokKind)[keyof typeof TokKind];

interface Token {
  kind: TokKind;
  text: string;
  number: number;
  line: number;
}

const makeToken = (kind: TokKind, text: string, number = 0.0, line = 1): Token => ({ kind, text, number, line });

function isSymbol(t: Token, s: string): boolean {
  return t.kind === TokKind.Symbol && t.text === s;
}

function isIdentifier(t: Token, s: string | null = null): boolean {
  return t.kind === TokKind.Identifier && (s === null || t.text === s);
}

/**
 * End of the character run strtod could possibly consume from a numeric
 * literal starting at `start` (digits, letters, '.', and a sign after an
 * exponent letter). strtod is applied to this bounded window so the lexer
 * stays linear in the source length.
 */
function numericRunEnd(source: string, start: number): number {
  let p = start;
  while (p < source.length) {
    const ch = source[p];
    if (isalnum(ch) || ch === '.') {
      ++p;
      continue;
    }
    if ((ch === '+' || ch === '-') && p > start && 'eEpP'.includes(source[p - 1])) {
      ++p;
      continue;
    }
    break;
  }
  return p;
}

class Lexer {
  private m_pos = 0;
  private m_line = 1;

  constructor(private readonly m_source: string) {}

  scan(): Token[] {
    const out: Token[] = [];
    const src = this.m_source;
    // Accept UTF-8 source files with a BOM before the first #include.
    // Without this, the BOM made the lexer think it was no longer at the
    // start of the line and the preprocessor directive leaked into C++.
    // (A decoded JavaScript string carries the BOM as the single U+FEFF.)
    if (this.m_pos === 0 && src.length >= 1 && src.charCodeAt(0) === 0xfeff) this.m_pos = 1;
    else if (
      this.m_pos === 0 &&
      src.length >= 3 &&
      src.charCodeAt(0) === 0xef &&
      src.charCodeAt(1) === 0xbb &&
      src.charCodeAt(2) === 0xbf
    )
      this.m_pos = 3;
    let lineStart = true;
    while (this.m_pos < src.length) {
      const c = src[this.m_pos];
      if (c === '\n') {
        ++this.m_line;
        ++this.m_pos;
        lineStart = true;
        continue;
      }
      if (isspace(c)) {
        ++this.m_pos;
        continue;
      }

      if (lineStart && c === '#') {
        while (this.m_pos < src.length && src[this.m_pos] !== '\n') ++this.m_pos;
        continue;
      }
      lineStart = false;

      if (c === '/' && this.peek(1) === '/') {
        this.m_pos += 2;
        while (this.m_pos < src.length && src[this.m_pos] !== '\n') ++this.m_pos;
        continue;
      }
      if (c === '/' && this.peek(1) === '*') {
        this.m_pos += 2;
        while (this.m_pos + 1 < src.length && !(src[this.m_pos] === '*' && src[this.m_pos + 1] === '/')) {
          if (src[this.m_pos] === '\n') ++this.m_line;
          ++this.m_pos;
        }
        if (this.m_pos + 1 < src.length) this.m_pos += 2;
        continue;
      }

      if (c === '"' || c === "'") {
        const quote = c;
        const line = this.m_line;
        ++this.m_pos;
        let value = '';
        while (this.m_pos < src.length && src[this.m_pos] !== quote) {
          const d = src[this.m_pos++];
          if (d === '\\' && this.m_pos < src.length) {
            const e = src[this.m_pos++];
            switch (e) {
              case 'n':
                value += '\n';
                break;
              case 't':
                value += '\t';
                break;
              case '\\':
                value += '\\';
                break;
              case "'":
                value += "'";
                break;
              case '"':
                value += '"';
                break;
              default:
                value += e;
                break;
            }
          } else {
            if (d === '\n') ++this.m_line;
            value += d;
          }
        }
        if (this.m_pos < src.length) ++this.m_pos;
        out.push(makeToken(TokKind.String, value, 0.0, line));
        continue;
      }

      if (isdigit(c) || (c === '.' && isdigit(this.peek(1)))) {
        const start = this.m_pos;
        const parsed = strtod(src.slice(start, numericRunEnd(src, start)));
        const value = parsed.value;
        const n = parsed.end;
        this.m_pos += n;
        // SDK definitions use C++ numeric suffixes (0x0010L, 1.5f).
        // Consume the suffix with the literal rather than as a name.
        const hex = n >= 2 && src[start] === '0' && (src[start + 1] === 'x' || src[start + 1] === 'X');
        while (this.m_pos < src.length) {
          const suffix = src[this.m_pos];
          if (
            suffix === 'u' ||
            suffix === 'U' ||
            suffix === 'l' ||
            suffix === 'L' ||
            (!hex && (suffix === 'f' || suffix === 'F'))
          )
            ++this.m_pos;
          else break;
        }
        out.push(makeToken(TokKind.Number, src.slice(start, this.m_pos), value, this.m_line));
        continue;
      }

      if (isalpha(c) || c === '_') {
        const start = this.m_pos++;
        while (this.m_pos < src.length) {
          const d = src[this.m_pos];
          if (!isalnum(d) && d !== '_') break;
          ++this.m_pos;
        }
        out.push(makeToken(TokKind.Identifier, src.slice(start, this.m_pos), 0.0, this.m_line));
        continue;
      }

      // Every multi-character symbol has two characters, so at most one of
      // them can match here (the C++ tries them in order).
      const op = src.slice(this.m_pos, this.m_pos + 2);
      if (kMultiCharSymbols.has(op)) {
        out.push(makeToken(TokKind.Symbol, op, 0.0, this.m_line));
        this.m_pos += op.length;
        continue;
      }

      if (kSingleCharSymbols.includes(c)) {
        out.push(makeToken(TokKind.Symbol, c, 0.0, this.m_line));
        ++this.m_pos;
        continue;
      }

      // Unknown punctuation is ignored rather than killing live preview.
      ++this.m_pos;
    }
    out.push(makeToken(TokKind.End, '', 0.0, this.m_line));
    return out;
  }

  private peek(offset: number): string {
    const p = this.m_pos + offset;
    return p < this.m_source.length ? this.m_source[p] : '\0';
  }
}

const kMultiCharSymbols: ReadonlySet<string> = new Set([
  '+=',
  '-=',
  '*=',
  '/=',
  '==',
  '!=',
  '<=',
  '>=',
  '++',
  '--',
  '&&',
  '||',
  '::',
  '->',
]);
const kSingleCharSymbols = '+-*/%(){}[];,.?:=<>!&';

const StatementKind = { Block: 0, Simple: 1, If: 2, For: 3, Function: 4, Empty: 5 } as const;
type StatementKind = (typeof StatementKind)[keyof typeof StatementKind];

class Statement {
  kind: StatementKind = StatementKind.Empty;
  startLine = 1;
  endLine = 1;
  tokens: Token[] = [];
  condition: Token[] = [];
  forInit: Token[] = [];
  forCondition: Token[] = [];
  forIncrement: Token[] = [];
  children: Statement[] = [];
  thenBranch: Statement | null = null;
  elseBranch: Statement | null = null;
  body: Statement | null = null;
  signature: Token[] = [];
  functionName = '';
}

function sliceTokens(v: readonly Token[], begin: number, end: number): Token[] {
  if (begin > end || end > v.length) return [];
  return v.slice(begin, end);
}

function tokensToExpression(tokens: readonly Token[]): string {
  let out = '';
  let previousKind: TokKind = TokKind.End;
  for (const token of tokens) {
    let text = token.text;
    if (token.kind === TokKind.String) text = `"${text}"`;

    const word = token.kind === TokKind.Identifier || token.kind === TokKind.Number || token.kind === TokKind.String;
    const previousWord =
      previousKind === TokKind.Identifier || previousKind === TokKind.Number || previousKind === TokKind.String;
    if (out !== '' && word && previousWord) out += ' ';
    out += text;
    previousKind = token.kind;
  }
  return out;
}

function splitTopLevel(tokens: readonly Token[], separator: string): Token[][] {
  const result: Token[][] = [];
  let start = 0;
  let paren = 0,
    bracket = 0,
    brace = 0;
  for (let i = 0; i < tokens.length; ++i) {
    const t = tokens[i];
    if (isSymbol(t, '(')) ++paren;
    else if (isSymbol(t, ')')) --paren;
    else if (isSymbol(t, '[')) ++bracket;
    else if (isSymbol(t, ']')) --bracket;
    else if (isSymbol(t, '{')) ++brace;
    else if (isSymbol(t, '}')) --brace;
    else if (paren === 0 && bracket === 0 && brace === 0 && t.text === separator) {
      result.push(sliceTokens(tokens, start, i));
      start = i + 1;
    }
  }
  result.push(sliceTokens(tokens, start, tokens.length));
  return result;
}

function normalizedScalarType(type: string): string {
  const canonical = sdkCanonicalType(type);
  if (canonical === 'float') return 'double';
  if (canonical === 'char') return 'string';
  return canonical;
}

function isScalarTypeToken(token: Token): boolean {
  if (token.kind !== TokKind.Identifier) return false;
  const t = sdkCanonicalType(token.text);
  return (
    t === 'double' || t === 'float' || t === 'int' || t === 'short' || t === 'long' || t === 'bool' || t === 'char'
  );
}

function parseRuntimeType(tokens: readonly Token[], pos: Ref<number>, type: Ref<string>): boolean {
  const original = pos.value;
  const qualifiers = () => {
    while (
      pos.value < tokens.length &&
      (isIdentifier(tokens[pos.value], 'const') || isIdentifier(tokens[pos.value], 'volatile'))
    )
      ++pos.value;
  };
  qualifiers();
  if (pos.value >= tokens.length || tokens[pos.value].kind !== TokKind.Identifier) {
    pos.value = original;
    return false;
  }
  type.value = tokens[pos.value++].text;
  while (
    pos.value + 1 < tokens.length &&
    isSymbol(tokens[pos.value], '::') &&
    tokens[pos.value + 1].kind === TokKind.Identifier
  ) {
    type.value += '::' + tokens[pos.value + 1].text;
    pos.value += 2;
  }
  if (
    type.value !== 'FdPoint3d' &&
    type.value !== 'FdVector3d' &&
    !sdkTypeDefinition(type.value) &&
    !isScalarTypeToken(makeToken(TokKind.Identifier, type.value))
  ) {
    pos.value = original;
    return false;
  }
  qualifiers();
  if (type.value === 'char' && pos.value < tokens.length && isSymbol(tokens[pos.value], '*')) {
    type.value = 'char*';
    ++pos.value;
    qualifiers();
  }
  return true;
}

function isNumericType(name: string): boolean {
  const type = sdkCanonicalType(name);
  return (
    type === 'double' || type === 'float' || type === 'int' || type === 'short' || type === 'long' || type === 'bool'
  );
}

function neutralParameterValue(type: string): string {
  if (type === 'string') return '';
  if (type === 'bool') return 'false';
  return '0';
}

function simpleInitializerValue(tokens: readonly Token[], type: string): string {
  if (tokens.length === 0) return neutralParameterValue(type);
  if (tokens.length === 1) {
    if (tokens[0].kind === TokKind.Number) return tokens[0].text;
    if (tokens[0].kind === TokKind.String) return tokens[0].text;
    if (tokens[0].kind === TokKind.Identifier && (tokens[0].text === 'true' || tokens[0].text === 'false'))
      return tokens[0].text;
  }
  if (
    tokens.length === 2 &&
    (isSymbol(tokens[0], '-') || isSymbol(tokens[0], '+')) &&
    tokens[1].kind === TokKind.Number
  )
    return tokens[0].text + tokens[1].text;
  return neutralParameterValue(type);
}

interface StaticParameterDecl {
  type: string;
  defaultValue: string;
}

function scanScalarDeclarations(tokens: readonly Token[]): Map<string, StaticParameterDecl> {
  const declarations = new Map<string, StaticParameterDecl>();

  for (let i = 0; i + 1 < tokens.length; ++i) {
    if (!isScalarTypeToken(tokens[i])) continue;

    let type = normalizedScalarType(tokens[i].text);
    let begin = i + 1;
    if (tokens[i].text === 'char' && begin < tokens.length && isSymbol(tokens[begin], '*')) {
      type = 'string';
      ++begin;
    }

    // Collect only the declaration/parameter fragment that follows this
    // type token. This is deliberately independent from runtime execution,
    // so get_val inputs are discoverable even when the cursor is above them.
    let end = begin;
    let paren = 0,
      bracket = 0,
      brace = 0;
    for (; end < tokens.length; ++end) {
      const t = tokens[end];
      if (isSymbol(t, '(')) ++paren;
      else if (isSymbol(t, ')')) {
        if (paren === 0 && bracket === 0 && brace === 0) break;
        --paren;
      } else if (isSymbol(t, '[')) ++bracket;
      else if (isSymbol(t, ']')) --bracket;
      else if (isSymbol(t, '{')) {
        if (paren === 0 && bracket === 0 && brace === 0) break;
        ++brace;
      } else if (isSymbol(t, '}')) {
        if (paren === 0 && bracket === 0 && brace === 0) break;
        --brace;
      } else if (isSymbol(t, ';') && paren === 0 && bracket === 0 && brace === 0) {
        break;
      }
    }

    const fragments = splitTopLevel(sliceTokens(tokens, begin, end), ',');
    for (const fragment of fragments) {
      if (fragment.length === 0) continue;

      let namePos = -1;
      for (let k = 0; k < fragment.length; ++k) {
        if (fragment[k].kind !== TokKind.Identifier) continue;
        const word = fragment[k].text;
        if (word === 'const' || word === 'volatile' || isScalarTypeToken(fragment[k])) continue;
        namePos = k;
        break;
      }
      if (namePos === -1) continue;

      let fragmentType = type;
      // A repeated explicit type in a function parameter fragment wins.
      for (let k = 0; k < namePos; ++k) {
        if (isScalarTypeToken(fragment[k])) {
          fragmentType = normalizedScalarType(fragment[k].text);
          if (fragment[k].text === 'char') fragmentType = 'string';
        }
      }

      let initializer: Token[] = [];
      let p = 0,
        b = 0,
        c = 0;
      for (let k = namePos + 1; k < fragment.length; ++k) {
        const t = fragment[k];
        if (isSymbol(t, '(')) ++p;
        else if (isSymbol(t, ')')) --p;
        else if (isSymbol(t, '[')) ++b;
        else if (isSymbol(t, ']')) --b;
        else if (isSymbol(t, '{')) ++c;
        else if (isSymbol(t, '}')) --c;
        else if (isSymbol(t, '=') && p === 0 && b === 0 && c === 0) {
          initializer = sliceTokens(fragment, k + 1, fragment.length);
          break;
        }
      }

      declarations.set(fragment[namePos].text, {
        type: fragmentType,
        defaultValue: simpleInitializerValue(initializer, fragmentType),
      });
    }
  }
  return declarations;
}

function scanGetValParameters(code: string): RuntimeParameterRequest[] {
  const tokens = new Lexer(code).scan();
  const declarations = scanScalarDeclarations(tokens);
  const out: RuntimeParameterRequest[] = [];

  for (let i = 0; i + 1 < tokens.length; ++i) {
    if (!isIdentifier(tokens[i], 'get_val') || !isSymbol(tokens[i + 1], '(')) continue;

    let close = i + 2;
    let depth = 1;
    for (; close < tokens.length; ++close) {
      if (isSymbol(tokens[close], '(')) ++depth;
      else if (isSymbol(tokens[close], ')')) {
        --depth;
        if (depth === 0) break;
      }
    }
    if (close >= tokens.length) continue;

    const args = splitTopLevel(sliceTokens(tokens, i + 2, close), ',');
    if (args.length !== 2 || args[0].length !== 1 || args[0][0].kind !== TokKind.String) continue;

    const req: RuntimeParameterRequest = {
      name: args[0][0].text,
      type: '',
      defaultValue: '',
      currentValue: '',
      sourceFunction: 'get_val',
      variableName: trim(tokensToExpression(args[1])),
      line: tokens[i].line,
    };

    let baseVariable = '';
    for (const t of args[1]) {
      if (t.kind === TokKind.Identifier) {
        baseVariable = t.text;
        break;
      }
    }
    const decl = declarations.get(baseVariable);
    if (decl !== undefined) {
      req.type = decl.type;
      req.defaultValue = decl.defaultValue;
    } else {
      req.type = 'unknown';
      req.defaultValue = '0';
    }
    req.currentValue = req.defaultValue;

    const duplicate = out.find((existing) => existing.name === req.name && existing.variableName === req.variableName);
    if (duplicate === undefined) out.push(req);
  }

  return out;
}

class ProgramParser {
  private m_pos = 0;

  constructor(private readonly m_tokens: Token[]) {}

  parse(): Statement {
    const root = new Statement();
    root.kind = StatementKind.Block;
    root.startLine = 1;
    while (!this.atEnd()) {
      if (isSymbol(this.current(), '}')) {
        this.advance();
        continue;
      }
      const stmt = this.parseStatement(true);
      if (stmt) root.children.push(stmt);
      else if (!this.atEnd()) this.advance();
    }
    root.endLine = this.current().line;
    return root;
  }

  private atEnd(): boolean {
    return this.current().kind === TokKind.End;
  }
  private current(offset = 0): Token {
    const p = Math.min(this.m_pos + offset, this.m_tokens.length - 1);
    return this.m_tokens[p];
  }
  private advance(): void {
    if (!this.atEnd()) ++this.m_pos;
  }

  private readParenthesized(): Token[] {
    if (!isSymbol(this.current(), '(')) throw runtimeError("expected '('");
    this.advance();
    const start = this.m_pos;
    let depth = 1;
    while (!this.atEnd() && depth > 0) {
      if (isSymbol(this.current(), '(')) ++depth;
      else if (isSymbol(this.current(), ')')) --depth;
      if (depth === 0) break;
      this.advance();
    }
    const end = this.m_pos;
    if (isSymbol(this.current(), ')')) this.advance();
    return sliceTokens(this.m_tokens, start, end);
  }

  private looksLikeFunctionDefinition(): boolean {
    if (
      isIdentifier(this.current(), 'if') ||
      isIdentifier(this.current(), 'for') ||
      isIdentifier(this.current(), 'else')
    )
      return false;
    let paren = 0,
      bracket = 0;
    let sawParen = false;
    for (let p = this.m_pos; p < this.m_tokens.length; ++p) {
      const t = this.m_tokens[p];
      if (t.kind === TokKind.End) return false;
      if (isSymbol(t, '(')) {
        ++paren;
        sawParen = true;
      } else if (isSymbol(t, ')')) --paren;
      else if (isSymbol(t, '[')) ++bracket;
      else if (isSymbol(t, ']')) --bracket;
      else if (paren === 0 && bracket === 0 && isSymbol(t, ';')) return false;
      else if (paren === 0 && bracket === 0 && isSymbol(t, '{')) return sawParen;
    }
    return false;
  }

  private parseFunction(): Statement {
    const fn = new Statement();
    fn.kind = StatementKind.Function;
    fn.startLine = this.current().line;
    const start = this.m_pos;
    let lparen = this.m_pos;
    let depth = 0;
    while (!this.atEnd()) {
      if (isSymbol(this.current(), '(') && depth === 0) lparen = this.m_pos;
      if (isSymbol(this.current(), '(')) ++depth;
      else if (isSymbol(this.current(), ')')) --depth;
      if (depth === 0 && isSymbol(this.current(), '{')) break;
      this.advance();
    }
    fn.signature = sliceTokens(this.m_tokens, start, this.m_pos);
    for (let i = lparen; i > start; --i) {
      if (this.m_tokens[i - 1].kind === TokKind.Identifier) {
        fn.functionName = this.m_tokens[i - 1].text;
        break;
      }
    }
    if (isSymbol(this.current(), '{')) {
      fn.body = this.parseBlock();
      fn.endLine = fn.body.endLine;
    }
    return fn;
  }

  private parseBlock(): Statement {
    const block = new Statement();
    block.kind = StatementKind.Block;
    block.startLine = this.current().line;
    if (isSymbol(this.current(), '{')) this.advance();
    while (!this.atEnd() && !isSymbol(this.current(), '}')) {
      const child = this.parseStatement(false);
      if (child) block.children.push(child);
      else if (!this.atEnd()) this.advance();
    }
    block.endLine = this.current().line;
    if (isSymbol(this.current(), '}')) this.advance();
    return block;
  }

  private parseStatement(allowFunction: boolean): Statement | null {
    if (this.atEnd()) return null;
    if (isSymbol(this.current(), ';')) {
      const e = new Statement();
      e.kind = StatementKind.Empty;
      e.startLine = e.endLine = this.current().line;
      this.advance();
      return e;
    }
    if (isSymbol(this.current(), '{')) return this.parseBlock();
    if (allowFunction && this.looksLikeFunctionDefinition()) return this.parseFunction();

    if (isIdentifier(this.current(), 'if')) {
      const s = new Statement();
      s.kind = StatementKind.If;
      s.startLine = this.current().line;
      this.advance();
      s.condition = this.readParenthesized();
      s.thenBranch = this.parseStatement(false);
      s.endLine = s.thenBranch ? s.thenBranch.endLine : s.startLine;
      if (isIdentifier(this.current(), 'else')) {
        this.advance();
        s.elseBranch = this.parseStatement(false);
        if (s.elseBranch) s.endLine = s.elseBranch.endLine;
      }
      return s;
    }

    if (isIdentifier(this.current(), 'for')) {
      const s = new Statement();
      s.kind = StatementKind.For;
      s.startLine = this.current().line;
      this.advance();
      const inside = this.readParenthesized();
      const clauses = splitTopLevel(inside, ';');
      if (clauses.length !== 0) s.forInit = clauses[0];
      if (clauses.length > 1) s.forCondition = clauses[1];
      if (clauses.length > 2) s.forIncrement = clauses[2];
      s.body = this.parseStatement(false);
      s.endLine = s.body ? s.body.endLine : s.startLine;
      return s;
    }

    const startLine = this.current().line;
    const start = this.m_pos;
    let paren = 0,
      bracket = 0,
      brace = 0;
    while (!this.atEnd()) {
      const t = this.current();
      if (isSymbol(t, '(')) ++paren;
      else if (isSymbol(t, ')')) --paren;
      else if (isSymbol(t, '[')) ++bracket;
      else if (isSymbol(t, ']')) --bracket;
      else if (isSymbol(t, '{')) ++brace;
      else if (isSymbol(t, '}')) {
        if (brace === 0) break;
        --brace;
      }
      if (paren === 0 && bracket === 0 && brace === 0 && isSymbol(t, ';')) {
        const s = new Statement();
        s.kind = StatementKind.Simple;
        s.startLine = startLine;
        s.endLine = t.line;
        s.tokens = sliceTokens(this.m_tokens, start, this.m_pos);
        this.advance();
        return s;
      }
      this.advance();
    }

    // A trailing line without ';' is considered "currently being typed".
    // Do not execute it and do not emit a diagnostic in live-preview mode.
    return null;
  }
}

function isNumeric(v: RuntimeValue): v is number | bigint | boolean {
  return isDouble(v) || isInt(v) || isBool(v);
}

function addValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a + b);
    return runtimeNumber(a) + runtimeNumber(b);
  }
  if (isPoint(a)) if (isVector(b)) return a.add(b);
  if (isVector(a)) if (isPoint(b)) return b.add(a);
  if (isVector(a)) if (isVector(b)) return a.add(b);
  if (isString(a)) if (isString(b)) return a + b;
  throw runtimeError(`invalid operands for +: ${runtimeTypeName(a)} and ${runtimeTypeName(b)}`);
}

function subValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a - b);
    return runtimeNumber(a) - runtimeNumber(b);
  }
  if (isPoint(a)) {
    const p: FdPoint3d = a;
    if (isVector(b)) return p.sub(b);
    if (isPoint(b)) return p.sub(b);
  }
  if (isVector(a)) if (isVector(b)) return a.sub(b);
  throw runtimeError(`invalid operands for -: ${runtimeTypeName(a)} and ${runtimeTypeName(b)}`);
}

function mulValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a * b);
    return runtimeNumber(a) * runtimeNumber(b);
  }
  if (isNumeric(a)) if (isVector(b)) return b.mul(runtimeNumber(a));
  if (isVector(a)) if (isNumeric(b)) return a.mul(runtimeNumber(b));
  throw runtimeError(`invalid operands for *: ${runtimeTypeName(a)} and ${runtimeTypeName(b)}`);
}

function divValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  const divisor = runtimeNumber(b);
  if (divisor === 0.0) throw runtimeError('division by zero');
  if (isNumeric(a)) return runtimeNumber(a) / divisor;
  if (isVector(a)) return a.div(divisor);
  throw runtimeError('invalid operands for /');
}

function modValues(a: RuntimeValue, b: RuntimeValue): RuntimeValue {
  const divisor = runtimeInteger(b);
  if (divisor === 0n) throw runtimeError('modulo by zero');
  return runtimeInteger(a) % divisor;
}

function negateValue(v: RuntimeValue): RuntimeValue {
  if (isInt(v)) return wrapInt64(-v);
  if (isNumeric(v)) return -runtimeNumber(v);
  if (isVector(v)) return v.neg();
  throw runtimeError('invalid unary - operand');
}

function equalValues(a: RuntimeValue, b: RuntimeValue): boolean {
  if (isNumeric(a) && isNumeric(b)) return runtimeNumber(a) === runtimeNumber(b);
  if (isString(a)) if (isString(b)) return a === b;
  if (isBool(a)) if (isBool(b)) return a === b;
  if (isPoint(a)) if (isPoint(b)) return a.x === b.x && a.y === b.y && a.z === b.z;
  if (isVector(a)) if (isVector(b)) return a.x === b.x && a.y === b.y && a.z === b.z;
  return false;
}

function tokensToText(tokens: readonly Token[]): string {
  let out = '';
  for (let i = 0; i < tokens.length; ++i) {
    const t = tokens[i];
    if (t.kind === TokKind.String) out += `"${t.text}"`;
    else out += t.text;
    if (i + 1 < tokens.length) {
      const n = tokens[i + 1];
      if (
        (t.kind === TokKind.Identifier || t.kind === TokKind.Number || t.kind === TokKind.String) &&
        (n.kind === TokKind.Identifier || n.kind === TokKind.Number || n.kind === TokKind.String)
      )
        out += ' ';
    }
  }
  return out;
}

function parseCallArguments(tokens: readonly Token[], lparen: number): Token[][] {
  if (lparen >= tokens.length || !isSymbol(tokens[lparen], '(')) return [];
  let start = lparen + 1;
  let paren = 0,
    bracket = 0,
    brace = 0;
  const args: Token[][] = [];
  for (let i = lparen + 1; i < tokens.length; ++i) {
    const t = tokens[i];
    if (isSymbol(t, '(')) ++paren;
    else if (isSymbol(t, ')')) {
      if (paren === 0 && bracket === 0 && brace === 0) {
        if (i > start) args.push(sliceTokens(tokens, start, i));
        else if (start !== lparen + 1) args.push([]);
        return args;
      }
      --paren;
    } else if (isSymbol(t, '[')) ++bracket;
    else if (isSymbol(t, ']')) --bracket;
    else if (isSymbol(t, '{')) ++brace;
    else if (isSymbol(t, '}')) --brace;
    else if (isSymbol(t, ',') && paren === 0 && bracket === 0 && brace === 0) {
      args.push(sliceTokens(tokens, start, i));
      start = i + 1;
    }
  }
  return args;
}

const kEndToken: Token = makeToken(TokKind.End, '', 0.0, 0);

class ExprParser {
  private m_pos = 0;

  constructor(
    private readonly m_tokens: readonly Token[],
    private readonly m_runtime: GeometryRuntime,
  ) {}

  parse(): RuntimeValue {
    if (this.m_tokens.length === 0) return undefined;
    const v = this.parseConditional();
    if (!this.atEnd()) throw runtimeError('unexpected token in expression: ' + this.current().text);
    return v;
  }

  private atEnd(): boolean {
    return this.m_pos >= this.m_tokens.length;
  }
  private current(offset = 0): Token {
    const p = this.m_pos + offset;
    return p < this.m_tokens.length ? this.m_tokens[p] : kEndToken;
  }
  private match(s: string): boolean {
    if (!this.atEnd() && this.current().text === s) {
      ++this.m_pos;
      return true;
    }
    return false;
  }
  private expect(s: string): void {
    if (!this.match(s)) throw runtimeError(`expected '${s}'`);
  }

  // The conditional and logical operators evaluate both operands, exactly
  // like the C++ runtime (no short-circuit evaluation).
  private parseConditional(): RuntimeValue {
    const cond = this.parseLogicalOr();
    if (this.match('?')) {
      const yes = this.parseConditional();
      this.expect(':');
      const no = this.parseConditional();
      return runtimeTruthy(cond) ? yes : no;
    }
    return cond;
  }

  private parseLogicalOr(): RuntimeValue {
    let lhs = this.parseLogicalAnd();
    while (this.match('||')) {
      const rhs = this.parseLogicalAnd();
      lhs = runtimeTruthy(lhs) || runtimeTruthy(rhs);
    }
    return lhs;
  }

  private parseLogicalAnd(): RuntimeValue {
    let lhs = this.parseEquality();
    while (this.match('&&')) {
      const rhs = this.parseEquality();
      lhs = runtimeTruthy(lhs) && runtimeTruthy(rhs);
    }
    return lhs;
  }

  private parseEquality(): RuntimeValue {
    let lhs = this.parseRelational();
    while (!this.atEnd() && (this.current().text === '==' || this.current().text === '!=')) {
      const op = this.current().text;
      ++this.m_pos;
      const rhs = this.parseRelational();
      const eq = equalValues(lhs, rhs);
      lhs = op === '==' ? eq : !eq;
    }
    return lhs;
  }

  private parseRelational(): RuntimeValue {
    let lhs = this.parseAdditive();
    while (
      !this.atEnd() &&
      (this.current().text === '<' ||
        this.current().text === '>' ||
        this.current().text === '<=' ||
        this.current().text === '>=')
    ) {
      const op = this.current().text;
      ++this.m_pos;
      const rhs = this.parseAdditive();
      let r: boolean;
      if (isNumeric(lhs) && isNumeric(rhs)) {
        const a = runtimeNumber(lhs),
          b = runtimeNumber(rhs);
        if (op === '<') r = a < b;
        else if (op === '>') r = a > b;
        else if (op === '<=') r = a <= b;
        else r = a >= b;
      } else if (isString(lhs) && isString(rhs)) {
        const a = lhs,
          b = rhs;
        if (op === '<') r = a < b;
        else if (op === '>') r = a > b;
        else if (op === '<=') r = a <= b;
        else r = a >= b;
      } else {
        throw runtimeError('invalid operands for comparison');
      }
      lhs = r;
    }
    return lhs;
  }

  private parseAdditive(): RuntimeValue {
    let lhs = this.parseMultiplicative();
    while (!this.atEnd() && (this.current().text === '+' || this.current().text === '-')) {
      const op = this.current().text;
      ++this.m_pos;
      const rhs = this.parseMultiplicative();
      lhs = op === '+' ? addValues(lhs, rhs) : subValues(lhs, rhs);
    }
    return lhs;
  }

  private parseMultiplicative(): RuntimeValue {
    let lhs = this.parseUnary();
    while (
      !this.atEnd() &&
      (this.current().text === '*' || this.current().text === '/' || this.current().text === '%')
    ) {
      const op = this.current().text;
      ++this.m_pos;
      const rhs = this.parseUnary();
      if (op === '*') lhs = mulValues(lhs, rhs);
      else if (op === '/') lhs = divValues(lhs, rhs);
      else lhs = modValues(lhs, rhs);
    }
    return lhs;
  }

  private isCastAhead(): boolean {
    if (this.atEnd() || this.current().text !== '(') return false;
    const pos = { value: this.m_pos + 1 };
    const type = { value: '' };
    return (
      parseRuntimeType(this.m_tokens, pos, type) &&
      isNumericType(type.value) &&
      pos.value < this.m_tokens.length &&
      isSymbol(this.m_tokens[pos.value], ')')
    );
  }

  private parseUnary(): RuntimeValue {
    if (this.match('!')) return !runtimeTruthy(this.parseUnary());
    if (this.match('-')) return negateValue(this.parseUnary());
    if (this.match('+')) return this.parseUnary();
    if (!this.atEnd() && isIdentifier(this.current(), 'static_cast')) {
      ++this.m_pos;
      this.expect('<');
      const type = { value: '' };
      const pos = { value: this.m_pos };
      const parsed = parseRuntimeType(this.m_tokens, pos, type);
      this.m_pos = pos.value;
      if (!parsed || !isNumericType(type.value)) throw runtimeError('unsupported static_cast type');
      this.expect('>');
      this.expect('(');
      const value = this.parseConditional();
      this.expect(')');
      return runtimeCoerceToType(value, type.value);
    }
    if (this.isCastAhead()) {
      ++this.m_pos;
      const type = { value: '' };
      const pos = { value: this.m_pos };
      parseRuntimeType(this.m_tokens, pos, type);
      this.m_pos = pos.value;
      this.expect(')');
      return runtimeCoerceToType(this.parseUnary(), type.value);
    }
    return this.parsePrimary();
  }

  private callFreeFunction(name: string, args: readonly RuntimeValue[]): RuntimeValue {
    if (isNumericType(name)) {
      if (args.length === 0) return runtimeDefaultValueForType(name);
      if (args.length !== 1) throw runtimeError(name + ' conversion requires one argument');
      return runtimeCoerceToType(args[0], name);
    }
    if (name === 'FdPoint3d' || name === 'FdVector3d') {
      if (args.length === 0) return name === 'FdPoint3d' ? new FdPoint3d() : new FdVector3d();
      if (args.length === 1) return runtimeCoerceToType(args[0], name);
      if (args.length !== 3) throw runtimeError(name + ' constructor requires 0, 1 or 3 arguments');
      const x = runtimeNumber(args[0]),
        y = runtimeNumber(args[1]),
        z = runtimeNumber(args[2]);
      return name === 'FdPoint3d' ? new FdPoint3d(x, y, z) : new FdVector3d(x, y, z);
    }
    if (name === 'sin') {
      if (args.length !== 1) throw runtimeError('sin requires 1 argument');
      return Math.sin(runtimeNumber(args[0]));
    }
    if (name === 'cos') {
      if (args.length !== 1) throw runtimeError('cos requires 1 argument');
      return Math.cos(runtimeNumber(args[0]));
    }
    if (name === 'tan') {
      if (args.length !== 1) throw runtimeError('tan requires 1 argument');
      return Math.tan(runtimeNumber(args[0]));
    }
    if (name === 'asin') {
      if (args.length !== 1) throw runtimeError('asin requires 1 argument');
      return Math.asin(runtimeNumber(args[0]));
    }
    if (name === 'acos') {
      if (args.length !== 1) throw runtimeError('acos requires 1 argument');
      return Math.acos(runtimeNumber(args[0]));
    }
    if (name === 'atan') {
      if (args.length !== 1) throw runtimeError('atan requires 1 argument');
      return Math.atan(runtimeNumber(args[0]));
    }
    if (name === 'atan2') {
      if (args.length !== 2) throw runtimeError('atan2 requires 2 arguments');
      return Math.atan2(runtimeNumber(args[0]), runtimeNumber(args[1]));
    }
    if (name === 'sqrt') {
      if (args.length !== 1) throw runtimeError('sqrt requires 1 argument');
      return Math.sqrt(runtimeNumber(args[0]));
    }
    if (name === 'floor') {
      if (args.length !== 1) throw runtimeError('floor requires 1 argument');
      return Math.floor(runtimeNumber(args[0]));
    }
    if (name === 'ceil') {
      if (args.length !== 1) throw runtimeError('ceil requires 1 argument');
      return Math.ceil(runtimeNumber(args[0]));
    }
    if (name === 'round') {
      if (args.length !== 1) throw runtimeError('round requires 1 argument');
      return cppRound(runtimeNumber(args[0]));
    }
    if (name === 'pow') {
      if (args.length !== 2) throw runtimeError('pow requires 2 arguments');
      return cppPow(runtimeNumber(args[0]), runtimeNumber(args[1]));
    }
    if (name === 'abs' || name === 'fabs') {
      if (args.length !== 1) throw runtimeError(name + ' requires 1 argument');
      return Math.abs(runtimeNumber(args[0]));
    }
    if (name === 'strcmp') {
      if (args.length !== 2) throw runtimeError('strcmp requires 2 arguments');
      const a = args[0];
      const b = args[1];
      if (!isString(a) || !isString(b)) throw runtimeError('strcmp requires string arguments');
      return a === b ? 0n : a < b ? -1n : 1n;
    }
    const macro = this.m_runtime.m_functionMacros.get(name);
    if (macro !== undefined) {
      if (args.length !== macro.parameters.length)
        throw runtimeError(`macro ${name} expects ${macro.parameters.length} argument(s)`);

      const values = this.m_runtime.m_values;
      const saved: { existed: boolean; value: RuntimeValue }[] = [];
      for (let i = 0; i < macro.parameters.length; ++i) {
        const existed = values.has(macro.parameters[i]);
        saved.push({ existed, value: existed ? runtimeDeepCopy(values.get(macro.parameters[i])) : undefined });
        values.set(macro.parameters[i], runtimeDeepCopy(args[i]));
      }

      const restore = () => {
        for (let i = 0; i < macro.parameters.length; ++i) {
          if (saved[i].existed) values.set(macro.parameters[i], saved[i].value);
          else values.delete(macro.parameters[i]);
        }
      };
      let result: RuntimeValue;
      try {
        const tokens = new Lexer(macro.expression).scan();
        if (tokens.length !== 0 && tokens[tokens.length - 1].kind === TokKind.End) tokens.pop();
        result = new ExprParser(tokens, this.m_runtime).parse();
      } catch (e) {
        restore();
        throw e;
      }
      restore();
      return result;
    }
    throw runtimeError('unsupported expression function: ' + name);
  }

  private callMethod(value: RuntimeValue, method: string, args: readonly RuntimeValue[]): RuntimeValue {
    if (isVector(value)) {
      const v = value;
      if (method === 'crossProduct') {
        const other = args[0];
        if (args.length !== 1 || !isVector(other)) throw runtimeError('crossProduct requires FdVector3d');
        return v.crossProduct(other);
      }
      if (method === 'dotProduct') {
        const other = args[0];
        if (args.length !== 1 || !isVector(other)) throw runtimeError('dotProduct requires FdVector3d');
        return v.dotProduct(other);
      }
      if (method === 'length') {
        if (args.length !== 0) throw runtimeError('length takes no arguments');
        return v.length();
      }
      if (method === 'lengthSqrd') {
        if (args.length !== 0) throw runtimeError('lengthSqrd takes no arguments');
        return v.lengthSqrd();
      }
      if (method === 'normal') {
        if (args.length > 1) throw runtimeError('normal takes zero or one tolerance argument');
        if (args.length === 1 && v.length() <= Math.abs(runtimeNumber(args[0]))) return new FdVector3d();
        return v.normal();
      }
      if (method === 'normalize') {
        if (args.length > 1) throw runtimeError('normalize takes zero or one tolerance argument');
        let copy = v;
        if (args.length === 1 && copy.length() <= Math.abs(runtimeNumber(args[0]))) return new FdVector3d();
        copy = copy.normalize();
        return copy;
      }
      if (method === 'perpVector') {
        if (args.length !== 0) throw runtimeError('perpVector takes no arguments');
        const n = v.normal();
        if (n.lengthSqrd() === 0.0) return new FdVector3d();
        const helper = Math.abs(n.z) < 0.85 ? new FdVector3d(0, 0, 1) : new FdVector3d(0, 1, 0);
        let p = n.crossProduct(helper);
        if (p.lengthSqrd() === 0.0) p = n.crossProduct(new FdVector3d(1, 0, 0));
        return p.normal();
      }
      if (method === 'rotateBy') {
        const axis = args[1];
        if (args.length !== 2 || !isVector(axis)) throw runtimeError('FdVector3d::rotateBy requires angle and axis');
        let copy = v;
        copy = copy.rotateBy(runtimeNumber(args[0]), axis);
        return copy;
      }
      if (method === 'mirror') {
        const normal = args[0];
        if (args.length !== 1 || !isVector(normal)) throw runtimeError('mirror requires FdVector3d');
        let copy = v;
        copy = copy.mirror(normal);
        return copy;
      }
      if (method === 'angleTo') {
        const other = args[0];
        if (args.length !== 1 || !isVector(other)) throw runtimeError('angleTo requires FdVector3d');
        return v.angleTo(other);
      }
    }
    if (isPoint(value)) {
      const p = value;
      if (method === 'rotateBy') {
        const axis = args[1];
        if (args.length === 2 && isVector(axis)) {
          let copy = p;
          copy = copy.rotateBy(runtimeNumber(args[0]), axis);
          return copy;
        }
        const center = args[2];
        if (args.length === 3 && isVector(axis) && isPoint(center)) {
          let copy = p;
          copy = copy.rotateBy(runtimeNumber(args[0]), axis, center);
          return copy;
        }
        throw runtimeError('FdPoint3d::rotateBy requires angle, axis [, center]');
      }
    }
    throw runtimeError('unsupported method in expression: ' + method);
  }

  private parseArguments(): RuntimeValue[] {
    const args: RuntimeValue[] = [];
    this.expect('(');
    if (this.match(')')) return args;
    while (true) {
      args.push(this.parseConditional());
      if (this.match(')')) break;
      this.expect(',');
    }
    return args;
  }

  private indexValue(value: RuntimeValue, index: bigint): RuntimeValue {
    if (isPoint(value)) {
      const p = value;
      if (index < 0n || index > 2n) throw runtimeError('FdPoint3d index out of range');
      return index === 0n ? p.x : index === 1n ? p.y : p.z;
    }
    if (isVector(value)) {
      const v = value;
      if (index < 0n || index > 2n) throw runtimeError('FdVector3d index out of range');
      return index === 0n ? v.x : index === 1n ? v.y : v.z;
    }
    if (!isArray(value)) throw runtimeError('indexing requires an array, FdPoint3d or FdVector3d');
    const a = value;
    if (index < 0n || index >= BigInt(a.elements.length)) throw runtimeError('array index out of range');
    return runtimeDeepCopy(a.elements[Number(index)]);
  }

  private memberValue(value: RuntimeValue, member: string): RuntimeValue {
    if (isPoint(value)) {
      const p = value;
      if (member === 'x') return p.x;
      if (member === 'y') return p.y;
      if (member === 'z') return p.z;
    }
    if (isVector(value)) {
      const v = value;
      if (member === 'x') return v.x;
      if (member === 'y') return v.y;
      if (member === 'z') return v.z;
    }
    throw runtimeError('member .' + member + ' is not available on ' + runtimeTypeName(value));
  }

  private parsePostfix(value: RuntimeValue): RuntimeValue {
    while (!this.atEnd()) {
      if (this.match('[')) {
        const idx = this.parseConditional();
        this.expect(']');
        value = this.indexValue(value, runtimeInteger(idx));
        continue;
      }
      if (this.match('.')) {
        if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected member name after .');
        const member = this.current().text;
        ++this.m_pos;
        if (!this.atEnd() && this.current().text === '(') {
          const args = this.parseArguments();
          value = this.callMethod(value, member, args);
        } else {
          value = this.memberValue(value, member);
        }
        continue;
      }
      break;
    }
    return value;
  }

  private parsePrimary(): RuntimeValue {
    if (this.atEnd()) throw runtimeError('expected expression');
    if (this.current().kind === TokKind.Number) {
      const v = this.current().number;
      const text = this.current().text;
      ++this.m_pos;
      const hex = text.length >= 2 && text[0] === '0' && (text[1] === 'x' || text[1] === 'X');
      const exponentChars = hex ? '.pP' : '.eEfF';
      if (![...text].some((ch) => exponentChars.includes(ch))) return doubleToInt64(v);
      return v;
    }
    if (this.current().kind === TokKind.String) {
      const s = this.current().text;
      ++this.m_pos;
      return s;
    }
    if (this.match('(')) {
      const v = this.parseConditional();
      this.expect(')');
      return this.parsePostfix(v);
    }
    if (this.current().kind !== TokKind.Identifier)
      throw runtimeError("expected expression near '" + this.current().text + "'");

    const nameLine = this.current().line;
    const name = this.current().text;
    ++this.m_pos;
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'NULL' || name === 'nullptr') return undefined;

    // SDK insulation queries are commonly used directly in if conditions.
    // With no host-project insulation value configured they return false.
    if (
      (name === 'getExtInsSize' || name === 'getIntInsSize') &&
      this.current().text === '(' &&
      this.current(1).kind === TokKind.Identifier &&
      this.current(2).text === ')'
    ) {
      ++this.m_pos;
      const destName = this.current().text;
      ++this.m_pos;
      this.expect(')');
      if (!this.m_runtime.m_parameters.has(name)) return false;
      const configured = this.m_runtime.m_parameters.get(name)!;
      const before = this.m_runtime.lookupValue(destName);
      let next = before;
      try {
        if (isDouble(before)) next = stod(trim(configured)).value;
        else if (isInt(before)) next = stoll(trim(configured)).value;
      } catch (e) {
        stdException(e);
        return false;
      }
      this.m_runtime.setVariable(destName, next, true, nameLine, name, configured);
      return true;
    }

    if (this.match('::')) {
      if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected name after ::');
      const member = this.current().text;
      ++this.m_pos;
      if (name === 'FdVector3d') {
        if (member === 'kXAxis') return new FdVector3d(1, 0, 0);
        if (member === 'kYAxis') return new FdVector3d(0, 1, 0);
        if (member === 'kZAxis') return new FdVector3d(0, 0, 1);
        if (member === 'kIdentity') return new FdVector3d(0, 0, 0);
      }
      if (name === 'FdPoint3d' && member === 'kOrigin') return new FdPoint3d();
      let qualified = name + '::' + member;
      while (this.match('::')) {
        if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected scoped name');
        qualified += '::' + this.current().text;
        ++this.m_pos;
      }
      if (!this.atEnd() && this.current().text === '(' && isNumericType(qualified))
        return this.callFreeFunction(qualified, this.parseArguments());
      return this.parsePostfix(this.m_runtime.lookupValue(qualified));
    }

    let value: RuntimeValue;
    if (!this.atEnd() && this.current().text === '(') {
      const args = this.parseArguments();
      value = this.callFreeFunction(name, args);
    } else {
      value = this.m_runtime.lookupValue(name);
    }

    return this.parsePostfix(value);
  }
}

/** Stands in for the C++ `RuntimeValue *` of an l-value. */
interface RuntimeValueSlot {
  get(): RuntimeValue;
  set(value: RuntimeValue): void;
}

/** A named variable in the runtime value map. */
class MapSlot implements RuntimeValueSlot {
  constructor(
    private readonly map: Map<string, RuntimeValue>,
    private readonly key: string,
  ) {}
  get(): RuntimeValue {
    return this.map.get(this.key);
  }
  set(value: RuntimeValue): void {
    this.map.set(this.key, value);
  }
}

/** An element of a (shared) runtime array. */
class ArraySlot implements RuntimeValueSlot {
  constructor(
    private readonly array: RuntimeArray,
    private readonly index: number,
  ) {}
  get(): RuntimeValue {
    return this.array.elements[this.index];
  }
  set(value: RuntimeValue): void {
    this.array.elements[this.index] = value;
  }
}

interface LValueRef {
  value: RuntimeValueSlot | null;
  member: string;
  path: string;
}

class RuntimeExecutor {
  private m_returned = false;
  private m_functionCallDepth = 0;
  private m_activeTopLevelFunction = '';
  private readonly m_functions = new Map<string, Statement[]>();
  private readonly m_parentApiStack: number[] = [];

  constructor(
    private readonly m_runtime: GeometryRuntime,
    private readonly m_maxLine: number,
  ) {}

  executeProgram(root: Statement): void {
    // Build a registry from the complete translation unit. User-defined
    // C++ functions are discovered from source; the preview runtime never
    // special-cases project-specific function names. Multiple definitions
    // with the same name are retained so simple overload resolution can
    // use the argument count.
    for (const child of root.children) {
      if (child.kind === StatementKind.Function && child.functionName !== '') {
        let overloads = this.m_functions.get(child.functionName);
        if (overloads === undefined) this.m_functions.set(child.functionName, (overloads = []));
        overloads.push(child);
      }
    }

    let selectedFunction: Statement | null = null;
    let latestBeforeCursor: Statement | null = null;
    for (const child of root.children) {
      if (child.kind !== StatementKind.Function) continue;
      if (child.startLine <= this.m_maxLine) latestBeforeCursor = child;
      if (child.startLine <= this.m_maxLine && this.m_maxLine <= child.endLine) {
        selectedFunction = child;
        break;
      }
    }
    // When the cursor is after the final function, execute the latest function in the source.
    if (!selectedFunction) selectedFunction = latestBeforeCursor;

    if (selectedFunction) {
      // Execute parseable global C++ declarations first. Explicit source
      // definitions, including overrides of preview defaults, are then
      // available to every function in this translation unit.
      ++this.m_functionCallDepth;
      for (const child of root.children) {
        if (child.kind !== StatementKind.Function) this.executeNode(child, false);
      }
      --this.m_functionCallDepth;

      this.m_activeTopLevelFunction = selectedFunction.functionName;
      this.initializeFunctionParameters(selectedFunction);
      if (selectedFunction.body) this.executeNode(selectedFunction.body);
    } else {
      this.executeNode(root, false);
    }
  }

  private evaluate(tokens: readonly Token[]): RuntimeValue {
    return new ExprParser(tokens, this.m_runtime).parse();
  }

  private safeExecute(s: Statement, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.m_runtime.addDiagnostic(s.startLine, stdException(e).message);
    }
  }

  private executeNode(s: Statement, skipFunctions = true): void {
    if (this.m_returned) return;
    if (this.m_functionCallDepth === 0 && s.startLine > this.m_maxLine) return;
    switch (s.kind) {
      case StatementKind.Block:
        for (const c of s.children) {
          if (this.m_returned) break;
          if (skipFunctions && c.kind === StatementKind.Function) continue;
          this.executeNode(c, skipFunctions);
        }
        break;
      case StatementKind.Simple:
        if (this.m_functionCallDepth > 0 || s.endLine <= this.m_maxLine)
          this.safeExecute(s, () => {
            this.executeSimple(s.tokens, s.startLine);
          });
        break;
      case StatementKind.If:
        this.safeExecute(s, () => {
          if (runtimeTruthy(this.evaluate(s.condition))) {
            if (s.thenBranch) this.executeNode(s.thenBranch);
          } else if (s.elseBranch) this.executeNode(s.elseBranch);
        });
        break;
      case StatementKind.For:
        this.safeExecute(s, () => {
          this.executeFor(s);
        });
        break;
      case StatementKind.Function:
        break;
      case StatementKind.Empty:
        break;
    }
  }

  private executeFor(s: Statement): void {
    if (s.forInit.length !== 0) this.executeSimple(s.forInit, s.startLine);
    const kMaxIterations = 10000;
    let count = 0;
    while (s.forCondition.length === 0 || runtimeTruthy(this.evaluate(s.forCondition))) {
      if (++count > kMaxIterations) throw runtimeError('loop exceeded 10000 iterations');
      if (s.body) this.executeNode(s.body);
      if (this.m_returned) return;
      if (s.forIncrement.length !== 0) this.executeSimple(s.forIncrement, s.startLine);
    }
  }

  private parseTypePrefix(tokens: readonly Token[], pos: Ref<number>, type: Ref<string>): boolean {
    return parseRuntimeType(tokens, pos, type);
  }

  private createArray(elementType: string, dims: readonly number[], level = 0): RuntimeArray {
    const array = new RuntimeArray();
    array.elementType = elementType;
    array.dimensions = dims.slice(level);
    const n = level < dims.length ? dims[level] : 0;
    for (let i = 0; i < n; ++i) {
      if (level + 1 < dims.length) array.elements.push(this.createArray(elementType, dims, level + 1));
      else array.elements.push(runtimeDefaultValueForType(elementType));
    }
    return array;
  }

  private initializerValue(
    tokens: readonly Token[],
    type: string,
    dims: readonly number[],
    level: number,
  ): RuntimeValue {
    if (level >= dims.length) return runtimeCoerceToType(this.evaluate(tokens), type);
    const array = this.createArray(type, dims, level);
    if (tokens.length === 0) return array;
    if (!isSymbol(tokens[0], '{') || !isSymbol(tokens[tokens.length - 1], '}')) {
      if (dims[level] > 0) array.elements[0] = this.initializerValue(tokens, type, dims, level + 1);
      return array;
    }
    const inner = sliceTokens(tokens, 1, tokens.length - 1);
    const parts = splitTopLevel(inner, ',');
    for (let i = 0; i < parts.length && i < array.elements.length; ++i) {
      if (parts[i].length === 0) continue;
      array.elements[i] = this.initializerValue(parts[i], type, dims, level + 1);
    }
    return array;
  }

  private directInitializer(type: string, tail: readonly Token[]): RuntimeValue {
    if (tail.length < 2 || !isSymbol(tail[0], '(') || !isSymbol(tail[tail.length - 1], ')'))
      throw runtimeError('invalid direct initializer');
    const inner = sliceTokens(tail, 1, tail.length - 1);
    const args = splitTopLevel(inner, ',');
    if (type === 'FdPoint3d' || type === 'FdVector3d') {
      if (inner.length === 0) return runtimeDefaultValueForType(type);
      if (args.length === 1) return runtimeCoerceToType(this.evaluate(args[0]), type);
      if (args.length === 3) {
        const x = runtimeNumber(this.evaluate(args[0]));
        const y = runtimeNumber(this.evaluate(args[1]));
        const z = runtimeNumber(this.evaluate(args[2]));
        return type === 'FdPoint3d' ? new FdPoint3d(x, y, z) : new FdVector3d(x, y, z);
      }
    }
    if (args.length === 1) return runtimeCoerceToType(this.evaluate(args[0]), type);
    throw runtimeError('unsupported direct initializer for ' + type);
  }

  private inferArrayDimensions(initializer: readonly Token[], dims: number[], level = 0): void {
    if (
      level >= dims.length ||
      initializer.length < 2 ||
      !isSymbol(initializer[0], '{') ||
      !isSymbol(initializer[initializer.length - 1], '}')
    )
      return;
    const parts = splitTopLevel(sliceTokens(initializer, 1, initializer.length - 1), ',');
    let count = parts.length;
    if (count === 1 && parts[0].length === 0) count = 0;
    if (dims[level] === 0) dims[level] = count;
    if (level + 1 >= dims.length) return;
    let maxChild = dims[level + 1];
    for (const part of parts) {
      if (part.length >= 2 && isSymbol(part[0], '{') && isSymbol(part[part.length - 1], '}')) {
        const childDims = [...dims];
        this.inferArrayDimensions(part, childDims, level + 1);
        maxChild = Math.max(maxChild, childDims[level + 1]);
      }
    }
    if (dims[level + 1] === 0) dims[level + 1] = maxChild;
  }

  private executeDeclaration(tokens: readonly Token[], line: number, userVariables = true): void {
    const pos = { value: 0 };
    const typeRef = { value: '' };
    if (!this.parseTypePrefix(tokens, pos, typeRef)) throw runtimeError('not a declaration');
    let type = typeRef.value;
    const alias = sdkTypeDefinition(type);
    if (alias) type = alias.baseType;
    const rest = sliceTokens(tokens, pos.value, tokens.length);
    const declarators = splitTopLevel(rest, ',');
    for (const decl of declarators) {
      if (decl.length === 0) continue;
      let p = 0;
      while (p < decl.length && (isSymbol(decl[p], '&') || isSymbol(decl[p], '*'))) ++p;
      if (p >= decl.length || decl[p].kind !== TokKind.Identifier)
        throw runtimeError('expected variable name in declaration');
      const name = decl[p++].text;
      const dims: number[] = [];
      while (p < decl.length && isSymbol(decl[p], '[')) {
        const b = ++p;
        let depth = 1;
        while (p < decl.length && depth > 0) {
          if (isSymbol(decl[p], '[')) ++depth;
          else if (isSymbol(decl[p], ']')) --depth;
          if (depth === 0) break;
          ++p;
        }
        const dimTokens = sliceTokens(decl, b, p);
        let n = 0;
        if (dimTokens.length !== 0) {
          const extent = runtimeInteger(this.evaluate(dimTokens));
          n = Number(extent > 0n ? extent : 0n);
        }
        dims.push(n);
        if (p < decl.length && isSymbol(decl[p], ']')) ++p;
      }

      if (alias && alias.arrayExtent) dims.push(alias.arrayExtent);
      const tail = sliceTokens(decl, p, decl.length);
      if (dims.length !== 0 && tail.length !== 0 && isSymbol(tail[0], '=')) {
        const rhs = sliceTokens(tail, 1, tail.length);
        this.inferArrayDimensions(rhs, dims, 0);
      }
      let value: RuntimeValue = dims.length === 0 ? runtimeDefaultValueForType(type) : this.createArray(type, dims);
      if (tail.length !== 0) {
        if (isSymbol(tail[0], '=')) {
          const rhs = sliceTokens(tail, 1, tail.length);
          if (dims.length !== 0) value = this.initializerValue(rhs, type, dims, 0);
          else value = runtimeCoerceToType(this.evaluateAssignmentExpression(rhs), type);
        } else if (isSymbol(tail[0], '(')) {
          if (dims.length !== 0) throw runtimeError('array direct initialization is not supported');
          value = this.directInitializer(type, tail);
        } else {
          throw runtimeError('unsupported declaration tail near ' + tokensToText(tail));
        }
      }
      const initializer = tail.length !== 0 && isSymbol(tail[0], '=') ? sliceTokens(tail, 1, tail.length) : tail;
      this.m_runtime.setVariable(
        name,
        runtimeDeepCopy(value),
        userVariables,
        line,
        'declare',
        tokensToExpression(initializer),
      );
    }
  }

  private resolveLValue(tokens: readonly Token[]): LValueRef {
    if (tokens.length === 0 || tokens[0].kind !== TokKind.Identifier) throw runtimeError('left side is not assignable');
    const root = tokens[0].text;
    if (!this.m_runtime.m_values.has(root)) throw runtimeError('unknown variable: ' + root);
    let currentValue: RuntimeValueSlot = new MapSlot(this.m_runtime.m_values, root);
    let path = root;
    let p = 1;
    while (p < tokens.length) {
      if (isSymbol(tokens[p], '[')) {
        const begin = ++p;
        let depth = 1;
        while (p < tokens.length && depth > 0) {
          if (isSymbol(tokens[p], '[')) ++depth;
          else if (isSymbol(tokens[p], ']')) --depth;
          if (depth === 0) break;
          ++p;
        }
        const idx = runtimeInteger(this.evaluate(sliceTokens(tokens, begin, p)));
        const arr = currentValue.get();
        if (!isArray(arr)) throw runtimeError('indexing requires array lvalue');
        if (idx < 0n || idx >= BigInt(arr.elements.length)) throw runtimeError('array index out of range');
        currentValue = new ArraySlot(arr, Number(idx));
        path += `[${idx}]`;
        if (p < tokens.length && isSymbol(tokens[p], ']')) ++p;
        continue;
      }
      if (isSymbol(tokens[p], '.')) {
        ++p;
        if (p >= tokens.length || tokens[p].kind !== TokKind.Identifier)
          throw runtimeError('expected member name after .');
        const member = tokens[p++].text;
        if (member !== 'x' && member !== 'y' && member !== 'z')
          throw runtimeError('member is not assignable: ' + member);
        if (p !== tokens.length) throw runtimeError('unexpected tokens after member lvalue');
        return { value: currentValue, member, path: path + '.' + member };
      }
      throw runtimeError('invalid lvalue near ' + tokens[p].text);
    }
    return { value: currentValue, member: '', path };
  }

  private readLValue(ref: LValueRef): RuntimeValue {
    if (!ref.value) throw runtimeError('invalid lvalue');
    const current = ref.value.get();
    if (ref.member === '') return runtimeDeepCopy(current);
    if (isPoint(current)) {
      const p = current;
      if (ref.member === 'x') return p.x;
      if (ref.member === 'y') return p.y;
      return p.z;
    }
    if (isVector(current)) {
      const v = current;
      if (ref.member === 'x') return v.x;
      if (ref.member === 'y') return v.y;
      return v.z;
    }
    throw runtimeError('.x/.y/.z requires FdPoint3d or FdVector3d');
  }

  private writeLValue(ref: LValueRef, value: RuntimeValue): void {
    if (!ref.value) throw runtimeError('invalid lvalue');
    if (ref.member === '') {
      const type = runtimeTypeName(ref.value.get());
      if (
        type === 'double' ||
        type === 'int' ||
        type === 'bool' ||
        type === 'FdPoint3d' ||
        type === 'FdVector3d' ||
        type === 'string'
      )
        ref.value.set(runtimeCoerceToType(value, type === 'string' ? 'string' : type));
      else ref.value.set(runtimeDeepCopy(value));
      return;
    }
    const n = runtimeNumber(value);
    const current = ref.value.get();
    if (isPoint(current)) {
      const p = current;
      if (ref.member === 'x') ref.value.set(new FdPoint3d(n, p.y, p.z));
      else if (ref.member === 'y') ref.value.set(new FdPoint3d(p.x, n, p.z));
      else ref.value.set(new FdPoint3d(p.x, p.y, n));
      return;
    }
    if (isVector(current)) {
      const v = current;
      if (ref.member === 'x') ref.value.set(new FdVector3d(n, v.y, v.z));
      else if (ref.member === 'y') ref.value.set(new FdVector3d(v.x, n, v.z));
      else ref.value.set(new FdVector3d(v.x, v.y, n));
      return;
    }
    throw runtimeError('.x/.y/.z requires FdPoint3d or FdVector3d');
  }

  private findTopLevelAssignment(tokens: readonly Token[], op: Ref<string>): number {
    let paren = 0,
      bracket = 0,
      brace = 0;
    for (let i = 0; i < tokens.length; ++i) {
      const t = tokens[i];
      if (isSymbol(t, '(')) ++paren;
      else if (isSymbol(t, ')')) --paren;
      else if (isSymbol(t, '[')) ++bracket;
      else if (isSymbol(t, ']')) --bracket;
      else if (isSymbol(t, '{')) ++brace;
      else if (isSymbol(t, '}')) --brace;
      else if (
        paren === 0 &&
        bracket === 0 &&
        brace === 0 &&
        (t.text === '=' || t.text === '+=' || t.text === '-=' || t.text === '*=' || t.text === '/=')
      ) {
        op.value = t.text;
        return i;
      }
    }
    return tokens.length;
  }

  private evaluateAssignmentExpression(tokens: readonly Token[], line = 0): RuntimeValue {
    const opRef = { value: '' };
    const pos = this.findTopLevelAssignment(tokens, opRef);
    const op = opRef.value;
    if (pos === tokens.length) return this.evaluate(tokens);
    const lhsTokens = sliceTokens(tokens, 0, pos);
    const rhsTokens = sliceTokens(tokens, pos + 1, tokens.length);
    const lhs = this.resolveLValue(lhsTokens);
    const rhs = this.evaluateAssignmentExpression(rhsTokens, line);
    const before = this.readLValue(lhs);
    let next = rhs;
    if (op !== '=') {
      const current = before;
      if (op === '+=') next = addValues(current, rhs);
      else if (op === '-=') next = subValues(current, rhs);
      else if (op === '*=') next = mulValues(current, rhs);
      else next = divValues(current, rhs);
    }
    const sources = this.m_runtime.captureValueSources(tokensToExpression(tokens));
    this.writeLValue(lhs, next);
    const after = this.readLValue(lhs);
    if (line > 0)
      this.m_runtime.recordVariableChange(line, lhs.path, op, tokensToExpression(rhsTokens), before, after, sources);
    return after;
  }

  private executeIncrement(tokens: readonly Token[], line: number): boolean {
    if (tokens.length < 2) return false;
    const prefix = tokens[0].text === '++' || tokens[0].text === '--';
    const postfix = tokens[tokens.length - 1].text === '++' || tokens[tokens.length - 1].text === '--';
    if (!prefix && !postfix) return false;
    const op = prefix ? tokens[0].text : tokens[tokens.length - 1].text;
    const lvt = prefix ? sliceTokens(tokens, 1, tokens.length) : sliceTokens(tokens, 0, tokens.length - 1);
    const ref = this.resolveLValue(lvt);
    const cur = this.readLValue(ref);
    const next = addValues(cur, op === '++' ? 1n : -1n);
    const sources = this.m_runtime.captureValueSources(tokensToExpression(lvt));
    this.writeLValue(ref, next);
    this.m_runtime.recordVariableChange(line, ref.path, op, '', cur, this.readLValue(ref), sources);
    return true;
  }

  private executeMutatingMethod(tokens: readonly Token[], line: number): boolean {
    let bracket = 0;
    let dot = tokens.length;
    for (let i = 0; i + 2 < tokens.length; ++i) {
      if (isSymbol(tokens[i], '[')) ++bracket;
      else if (isSymbol(tokens[i], ']')) --bracket;
      else if (
        bracket === 0 &&
        isSymbol(tokens[i], '.') &&
        tokens[i + 1].kind === TokKind.Identifier &&
        isSymbol(tokens[i + 2], '(')
      ) {
        dot = i;
        break;
      }
    }
    if (dot === tokens.length) return false;
    const method = tokens[dot + 1].text;
    if (method !== 'rotateBy' && method !== 'normalize' && method !== 'mirror' && method !== 'set') return false;
    const ref = this.resolveLValue(sliceTokens(tokens, 0, dot));
    if (ref.member !== '') throw runtimeError('method call on scalar member is invalid');
    const before = this.readLValue(ref);
    const argGroups = parseCallArguments(tokens, dot + 2);
    const args: RuntimeValue[] = [];
    for (const g of argGroups) args.push(this.evaluate(g));
    const sources = this.m_runtime.captureValueSources(tokensToExpression(tokens));
    const changed = () => {
      this.m_runtime.recordVariableChange(
        line,
        ref.path,
        method,
        tokensToExpression(tokens),
        before,
        this.readLValue(ref),
        sources,
      );
      return true;
    };
    const slot = ref.value!;

    if (method === 'rotateBy') {
      const p = slot.get();
      if (isPoint(p)) {
        const axis = args[1];
        if (args.length < 2 || args.length > 3 || !isVector(axis))
          throw runtimeError('FdPoint3d::rotateBy(angle, axis [, point])');
        const centerArg = args[2];
        const center = args.length === 3 && isPoint(centerArg) ? centerArg : new FdPoint3d();
        slot.set(p.rotateBy(runtimeNumber(args[0]), axis, center));
        return changed();
      }
      const v = slot.get();
      if (isVector(v)) {
        const axis = args[1];
        if (args.length !== 2 || !isVector(axis)) throw runtimeError('FdVector3d::rotateBy(angle, axis)');
        slot.set(v.rotateBy(runtimeNumber(args[0]), axis));
        return changed();
      }
    }
    if (method === 'normalize') {
      const v = slot.get();
      if (!isVector(v)) throw runtimeError('normalize requires FdVector3d');
      slot.set(v.normalize());
      return changed();
    }
    if (method === 'mirror') {
      const v = slot.get();
      const normal = args[0];
      if (!isVector(v) || args.length !== 1 || !isVector(normal))
        throw runtimeError('mirror requires FdVector3d normal');
      slot.set(v.mirror(normal));
      return changed();
    }
    if (method === 'set') {
      if (args.length !== 3) throw runtimeError('set requires x, y, z');
      const x = runtimeNumber(args[0]),
        y = runtimeNumber(args[1]),
        z = runtimeNumber(args[2]);
      const target = slot.get();
      if (isPoint(target)) {
        slot.set(new FdPoint3d(x, y, z));
        return changed();
      }
      if (isVector(target)) {
        slot.set(new FdVector3d(x, y, z));
        return changed();
      }
    }
    return false;
  }

  private parameterTextToValue(text: string, current: RuntimeValue): RuntimeValue {
    if (isString(current)) return text;
    if (isBool(current)) {
      const value = trim(text);
      if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
      if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
      return current;
    }
    if (isInt(current)) {
      try {
        const parsed = stoll(trim(text));
        if (parsed.used === trim(text).length) return parsed.value;
      } catch (e) {
        stdException(e);
      }
      return current;
    }
    if (isDouble(current)) {
      try {
        const value = trim(text);
        const parsed = stod(value);
        if (parsed.used === value.length) return parsed.value;
      } catch (e) {
        stdException(e);
      }
      return current;
    }
    return current;
  }

  private executeFreeCall(tokens: readonly Token[], line: number): boolean {
    if (tokens.length < 2 || tokens[0].kind !== TokKind.Identifier || !isSymbol(tokens[1], '(')) return false;
    const name = tokens[0].text;
    const argGroups = parseCallArguments(tokens, 1);

    if (name === 'get_val') {
      if (argGroups.length !== 2) throw runtimeError('get_val requires parameter name and destination');
      const paramName = this.evaluate(argGroups[0]);
      if (!isString(paramName)) throw runtimeError('get_val parameter name must be a string');
      const s = paramName;
      const dest = this.resolveLValue(argGroups[1]);
      const before = this.readLValue(dest);
      let defaultValue = runtimeValueToCompactString(before);
      if (isString(before) && defaultValue === '""') defaultValue = '';

      if (this.m_runtime.m_parameters.has(s)) {
        const parsed = this.parameterTextToValue(this.m_runtime.m_parameters.get(s)!, before);
        this.writeLValue(dest, parsed);
        const after = this.readLValue(dest);
        if (runtimeValueToCompactString(before) !== runtimeValueToCompactString(after))
          this.m_runtime.recordVariableChange(line, dest.path, 'get_val', s, before, after);
      }

      const effective = this.readLValue(dest);
      const req: RuntimeParameterRequest = {
        name: s,
        type: runtimeTypeName(before),
        defaultValue,
        currentValue: runtimeValueToCompactString(effective),
        sourceFunction: '',
        variableName: '',
        line: 0,
      };
      if (isString(effective) && req.currentValue === '""') req.currentValue = '';
      req.sourceFunction = 'get_val';
      req.variableName = dest.path;
      req.line = line;
      this.m_runtime.recordParameterRequest(req);
      return true;
    }

    if (
      name === 'get_fln_size' ||
      name === 'get_fln_thick' ||
      name === 'get_fln_diam' ||
      name === 'get_ldist' ||
      name === 'get_ext_diam'
    ) {
      if (argGroups.length >= 2) {
        const id = this.evaluate(argGroups[0]);
        const dest = this.resolveLValue(argGroups[1]);
        const current = this.readLValue(dest);
        const key = (isString(id) ? id : '') + ':' + name;
        const req: RuntimeParameterRequest = {
          name: key,
          type: runtimeTypeName(current),
          defaultValue: runtimeValueToCompactString(current),
          currentValue: '',
          sourceFunction: name,
          variableName: dest.path,
          line,
        };
        req.currentValue = req.defaultValue;
        this.m_runtime.recordParameterRequest(req);
        if (this.m_runtime.m_parameters.has(key))
          this.writeLValue(dest, this.parameterTextToValue(this.m_runtime.m_parameters.get(key)!, current));
      }
      return true;
    }

    if (name === 'lineSegToLineSegInt' || name === 'lineToLineInt') {
      if (argGroups.length !== 5) throw runtimeError(name + ' requires 5 arguments');
      const a0 = this.evaluate(argGroups[0]);
      const a1 = this.evaluate(argGroups[1]);
      const b0 = this.evaluate(argGroups[2]);
      const b1 = this.evaluate(argGroups[3]);
      if (!isPoint(a0) || !isPoint(a1) || !isPoint(b0) || !isPoint(b1))
        throw runtimeError(name + ' requires four FdPoint3d inputs');
      const outRef = this.resolveLValue(argGroups[4]);
      const before = this.readLValue(outRef);
      if (!isPoint(before)) throw runtimeError(name + ' output must be FdPoint3d');
      const intersection = { value: new FdPoint3d() };
      const hit = RuntimeExecutor.lineIntersection(a0, a1, b0, b1, name === 'lineSegToLineSegInt', intersection);
      if (hit) {
        const sources = this.m_runtime.captureValueSources(tokensToExpression(tokens));
        this.writeLValue(outRef, intersection.value);
        this.m_runtime.recordVariableChange(
          line,
          outRef.path,
          name,
          tokensToExpression(tokens),
          before,
          this.readLValue(outRef),
          sources,
        );
      }

      const call = emptyApiCall();
      call.line = line;
      call.parentApiIndex =
        this.m_parentApiStack.length === 0 ? -1 : this.m_parentApiStack[this.m_parentApiStack.length - 1];
      call.name = name;
      call.arguments = [
        runtimeDeepCopy(a0),
        runtimeDeepCopy(a1),
        runtimeDeepCopy(b0),
        runtimeDeepCopy(b1),
        runtimeDeepCopy(this.readLValue(outRef)),
      ];
      for (const group of argGroups) call.argumentExpressions.push(tokensToExpression(group));
      call.display = name + '(';
      for (let i = 0; i < call.argumentExpressions.length; ++i) {
        if (i) call.display += ', ';
        call.display += call.argumentExpressions[i];
      }
      call.display += ');';
      this.m_runtime.recordApiCall(call);
      return true;
    }

    if (name === 'setPrimitiveMode' && argGroups.length === 1) {
      const mode = this.evaluate(argGroups[0]);
      this.m_runtime.setVariable('m_primitiveMode', runtimeCoerceToType(mode, 'int'), false);
    }

    if (name === 'ASSERT' || name === 'delete') return true;

    const args: RuntimeValue[] = [];
    let hasUnresolvedArgument = false;
    for (let i = 0; i < argGroups.length; ++i) {
      try {
        args.push(runtimeDeepCopy(this.evaluate(argGroups[i])));
      } catch (e) {
        // Keep the native/API call in the trace even when one argument
        // cannot yet be evaluated. This is important for source snippets
        // that depend on project-level constants declared outside the
        // pasted fragment (for example a tessellation/complexity value).
        // The unresolved slot is represented by monostate; the preview
        // adapter may only substitute a visualization-only value for
        // parameters that do not change the geometry's position/size.
        this.m_runtime.addDiagnostic(
          line,
          `cannot evaluate argument ${i + 1}` +
            ' of ' +
            name +
            ' (' +
            tokensToExpression(argGroups[i]) +
            '): ' +
            stdException(e).message,
        );
        args.push(undefined);
        hasUnresolvedArgument = true;
      }
    }
    const call = emptyApiCall();
    call.line = line;
    call.parentApiIndex =
      this.m_parentApiStack.length === 0 ? -1 : this.m_parentApiStack[this.m_parentApiStack.length - 1];
    call.name = name;
    call.arguments = [...args];
    for (const group of argGroups) call.argumentExpressions.push(tokensToExpression(group));

    // Keep the trace source-oriented. Evaluated values are immutable
    // snapshots and are shown only when the user expands the row.
    call.display = name + '(';
    for (let i = 0; i < call.argumentExpressions.length; ++i) {
      if (i) call.display += ', ';
      call.display += call.argumentExpressions[i];
    }
    call.display += ');';

    const fn = this.resolveUserFunction(name, args.length);
    if (fn) {
      call.userFunctionCall = true;
      this.populateFormalParameterMetadata(call, fn);
      const functionIndex = this.m_runtime.recordApiCall(call);
      // A C++ function body cannot be executed faithfully with unresolved
      // arguments. Keep the call visible in API Trace, but stop here and
      // let the diagnostic explain which source expression is missing.
      if (!hasUnresolvedArgument) this.executeUserFunction(fn, args, argGroups, functionIndex);
      return true;
    }

    // Native calls must exist in the generated SDK registry. Do not silently
    // accept an invented make/add/draw function, because doing so can create
    // misleading preview geometry. External non-geometry calls remain traceable.
    if (
      !apiSignatureMetadataForCall(call) &&
      (name.startsWith('make') || name.startsWith('add') || name.startsWith('draw'))
    ) {
      this.m_runtime.addDiagnostic(line, 'unknown native geometry API: ' + name);
      return true;
    }
    this.m_runtime.recordApiCall(call);
    return true;
  }

  private functionParameters(fn: Statement): Token[][] {
    const sig = fn.signature;
    let lp = sig.length,
      rp = sig.length;
    let depth = 0;
    for (let i = 0; i < sig.length; ++i) {
      if (isSymbol(sig[i], '(')) {
        if (depth++ === 0) lp = i;
      } else if (isSymbol(sig[i], ')')) {
        if (--depth === 0) {
          rp = i;
          break;
        }
      }
    }
    if (lp >= rp || rp > sig.length) return [];
    let result = splitTopLevel(sliceTokens(sig, lp + 1, rp), ',');
    if (result.length === 1 && result[0].length === 0) result = [];
    else if (result.length === 1 && result[0].length === 1 && isIdentifier(result[0][0], 'void')) result = [];
    return result;
  }

  private parameterDefaultPos(param: readonly Token[]): number {
    let paren = 0,
      bracket = 0,
      brace = 0;
    for (let i = 0; i < param.length; ++i) {
      if (isSymbol(param[i], '(')) ++paren;
      else if (isSymbol(param[i], ')')) --paren;
      else if (isSymbol(param[i], '[')) ++bracket;
      else if (isSymbol(param[i], ']')) --bracket;
      else if (isSymbol(param[i], '{')) ++brace;
      else if (isSymbol(param[i], '}')) --brace;
      else if (paren === 0 && bracket === 0 && brace === 0 && isSymbol(param[i], '=')) return i;
    }
    return param.length;
  }

  private parameterName(param: readonly Token[]): string {
    const end = this.parameterDefaultPos(param);
    for (let i = end; i > 0; --i) {
      const t = param[i - 1];
      if (t.kind !== TokKind.Identifier) continue;
      if (kParameterQualifiers.includes(t.text)) continue;
      // Identifiers adjacent to :: belong to a qualified type name.
      if (i < end && isSymbol(param[i], '::')) continue;
      if (i >= 2 && isSymbol(param[i - 2], '::')) continue;
      return t.text;
    }
    return '';
  }

  private parameterType(param: readonly Token[]): string {
    const name = this.parameterName(param);
    if (name === '') return '';
    const end = this.parameterDefaultPos(param);
    const typeTokens: Token[] = [];
    let removedName = false;
    for (let i = 0; i < end; ++i) {
      if (!removedName && param[i].kind === TokKind.Identifier && param[i].text === name) {
        removedName = true;
        continue;
      }
      typeTokens.push(param[i]);
    }
    return trim(tokensToExpression(typeTokens));
  }

  private requiredParameterCount(fn: Statement): number {
    const params = this.functionParameters(fn);
    let required = 0;
    for (const param of params) {
      if (this.parameterDefaultPos(param) === param.length) ++required;
    }
    return required;
  }

  private resolveUserFunction(name: string, argumentCount: number): Statement | null {
    const candidates = this.m_functions.get(name);
    if (candidates === undefined) return null;

    let fallback: Statement | null = null;
    for (const fn of candidates) {
      const params = this.functionParameters(fn);
      const total = params.length;
      const required = this.requiredParameterCount(fn);
      if (argumentCount < required || argumentCount > total) continue;
      if (argumentCount === total) return fn;
      if (!fallback) fallback = fn;
    }
    return fallback;
  }

  private populateFormalParameterMetadata(call: RuntimeApiCall, fn: Statement): void {
    const params = this.functionParameters(fn);
    for (const param of params) {
      call.formalParameterNames.push(this.parameterName(param));
      call.formalParameterTypes.push(this.parameterType(param));
    }
  }

  private bindFunctionArguments(
    fn: Statement,
    args: readonly RuntimeValue[],
    traces: readonly RuntimeArgumentTrace[],
  ): void {
    const params = this.functionParameters(fn);
    for (let i = 0; i < params.length; ++i) {
      const name = this.parameterName(params[i]);
      if (name === '') continue;

      let value: RuntimeValue = undefined;
      if (i < args.length) {
        value = runtimeDeepCopy(args[i]);
      } else {
        const eq = this.parameterDefaultPos(params[i]);
        if (eq < params[i].length) {
          try {
            value = runtimeDeepCopy(this.evaluate(sliceTokens(params[i], eq + 1, params[i].length)));
          } catch (e) {
            stdException(e);
            value = undefined;
          }
        }
      }
      const trace = i < traces.length ? traces[i] : null;
      const eq = this.parameterDefaultPos(params[i]);
      const expression = trace
        ? trace.expression
        : tokensToExpression(sliceTokens(params[i], Math.min(eq + 1, params[i].length), params[i].length));
      this.m_runtime.setVariable(name, value, false, fn.startLine, 'bind', expression, trace);
    }
  }

  private writableReferenceParameter(param: readonly Token[]): boolean {
    const end = this.parameterDefaultPos(param);
    let hasReference = false;
    let isConst = false;
    for (let i = 0; i < end; ++i) {
      if (isSymbol(param[i], '&')) hasReference = true;
      if (isIdentifier(param[i], 'const')) isConst = true;
    }
    return hasReference && !isConst;
  }

  private static lineIntersection(
    p1: FdPoint3d,
    p2: FdPoint3d,
    q1: FdPoint3d,
    q2: FdPoint3d,
    segments: boolean,
    out: Ref<FdPoint3d>,
  ): boolean {
    const u = p2.sub(p1);
    const v = q2.sub(q1);
    const w = p1.sub(q1);
    const a = u.dotProduct(u);
    const b = u.dotProduct(v);
    const c = v.dotProduct(v);
    const d = u.dotProduct(w);
    const e = v.dotProduct(w);
    const den = a * c - b * b;
    if (a <= 1e-12 || c <= 1e-12 || Math.abs(den) <= 1e-12) return false;
    const s = (b * e - c * d) / den;
    const t = (a * e - b * d) / den;
    if (segments && (s < -1e-9 || s > 1.0 + 1e-9 || t < -1e-9 || t > 1.0 + 1e-9)) return false;
    const pa = p1.add(u.mul(s));
    const pb = q1.add(v.mul(t));
    const delta = pa.sub(pb);
    // std::max({1.0, u.length(), v.length()}) (a NaN never replaces the maximum).
    let scale = 1.0;
    for (const length of [u.length(), v.length()]) if (scale < length) scale = length;
    if (delta.length() > 1e-7 * scale) return false;
    out.value = new FdPoint3d((pa.x + pb.x) * 0.5, (pa.y + pb.y) * 0.5, (pa.z + pb.z) * 0.5);
    return true;
  }

  private executeUserFunction(
    fn: Statement,
    args: readonly RuntimeValue[],
    argumentTokens: readonly Token[][],
    parentApiIndex: number,
  ): void {
    if (this.m_functionCallDepth >= 64) throw runtimeError('C++ function call depth exceeded 64');

    // Copies of the value map share arrays, like the copied std::unordered_map
    // shares its RuntimeArrayPtr values.
    const savedValues = new Map(this.m_runtime.m_values);
    const savedVariableIds = new Map(this.m_runtime.m_variableIds);
    const savedOrder = [...this.m_runtime.m_userVariableOrder];
    const savedReturned = this.m_returned;
    const savedActive = this.m_activeTopLevelFunction;

    const inputTraces = this.m_runtime.m_apiCalls[parentApiIndex].argumentTraces;
    this.bindFunctionArguments(fn, args, inputTraces);
    this.m_returned = false;
    this.m_activeTopLevelFunction = fn.functionName;
    ++this.m_functionCallDepth;
    this.m_parentApiStack.push(parentApiIndex);
    if (fn.body) this.executeNode(fn.body);
    this.m_parentApiStack.pop();
    --this.m_functionCallDepth;

    interface ReferenceOutput {
      index: number;
      value: RuntimeValue;
      sources: RuntimeValueSource[];
    }
    const outputs: ReferenceOutput[] = [];
    const params = this.functionParameters(fn);
    for (let i = 0; i < params.length && i < argumentTokens.length; ++i) {
      if (!this.writableReferenceParameter(params[i])) continue;
      const name = this.parameterName(params[i]);
      if (name === '' || !this.m_runtime.hasVariable(name)) continue;
      outputs.push({
        index: i,
        value: this.m_runtime.lookupValue(name),
        sources: this.m_runtime.captureValueSources(name),
      });
    }

    this.m_runtime.m_values = savedValues;
    this.m_runtime.m_variableIds = savedVariableIds;
    this.m_runtime.m_userVariableOrder = savedOrder;
    this.m_returned = savedReturned;
    this.m_activeTopLevelFunction = savedActive;

    const callLine =
      parentApiIndex >= 0 && parentApiIndex < this.m_runtime.m_apiCalls.length
        ? this.m_runtime.m_apiCalls[parentApiIndex].line
        : fn.startLine;
    for (const output of outputs) {
      try {
        const dest = this.resolveLValue(argumentTokens[output.index]);
        const before = this.readLValue(dest);
        this.writeLValue(dest, output.value);
        const after = this.readLValue(dest);
        if (runtimeValueToCompactString(before) !== runtimeValueToCompactString(after))
          this.m_runtime.recordVariableChange(
            callLine,
            dest.path,
            'reference write-back',
            fn.functionName,
            before,
            after,
            output.sources,
          );
      } catch (e) {
        this.m_runtime.addDiagnostic(
          callLine,
          'cannot write back reference parameter of ' + fn.functionName + ': ' + stdException(e).message,
        );
      }
    }
  }

  private executeSimple(tokens: readonly Token[], line: number): void {
    if (tokens.length === 0) return;
    if (isIdentifier(tokens[0], 'return')) {
      this.m_returned = true;
      return;
    }
    if (isIdentifier(tokens[0], 'delete')) return;
    if (isIdentifier(tokens[0], 'typedef')) {
      const pos = { value: 1 };
      const base = { value: '' };
      if (parseRuntimeType(tokens, pos, base) && pos.value < tokens.length) {
        const alias = sdkTypeDefinition(tokens[pos.value++].text);
        let extent = 0;
        if (pos.value + 2 < tokens.length && isSymbol(tokens[pos.value], '[') && isSymbol(tokens[pos.value + 2], ']')) {
          extent = Math.trunc(tokens[pos.value + 1].number);
          pos.value += 3;
        }
        if (
          alias &&
          sdkCanonicalType(base.value) === alias.baseType &&
          extent === alias.arrayExtent &&
          pos.value === tokens.length
        )
          return;
      }
      throw runtimeError('unsupported typedef (only known SDK type definitions are available)');
    }

    const typePos = { value: 0 };
    const type = { value: '' };
    if (this.parseTypePrefix(tokens, typePos, type)) {
      this.executeDeclaration(tokens, line);
      return;
    }
    // Opaque project/object declarations (for example GRUNDFOSBlockCreator oBlkCreator(...)).
    // They are not needed for geometry preview, but accepting them lets complete project functions parse cleanly.
    if (tokens.length >= 2 && tokens[0].kind === TokKind.Identifier && tokens[1].kind === TokKind.Identifier) {
      this.m_runtime.setVariable(tokens[1].text, undefined, true, line, 'declare', tokensToExpression(tokens));
      return;
    }
    if (this.executeIncrement(tokens, line)) return;
    if (this.executeMutatingMethod(tokens, line)) return;

    const assignmentOp = { value: '' };
    if (this.findTopLevelAssignment(tokens, assignmentOp) !== tokens.length) {
      this.evaluateAssignmentExpression(tokens, line);
      return;
    }
    if (this.executeFreeCall(tokens, line)) return;

    // Valid standalone expression; evaluate for diagnostics/state effects only.
    this.evaluate(tokens);
  }

  private initializeFunctionParameters(fn: Statement): void {
    const sig = fn.signature;
    let lp = sig.length,
      rp = sig.length;
    let depth = 0;
    for (let i = 0; i < sig.length; ++i) {
      if (isSymbol(sig[i], '(')) {
        if (depth++ === 0) lp = i;
      } else if (isSymbol(sig[i], ')')) {
        if (--depth === 0) {
          rp = i;
          break;
        }
      }
    }
    if (lp >= rp || rp > sig.length) return;
    const params = splitTopLevel(sliceTokens(sig, lp + 1, rp), ',');
    for (const param of params) {
      if (param.length === 0 || (param.length === 1 && isIdentifier(param[0], 'void'))) continue;
      try {
        this.executeDeclaration(param, fn.startLine, true);
      } catch (e) {
        stdException(e);
        // Parameters may include project-specific pointer/reference types that are not required by the preview runtime.
      }
    }
  }
}

const kParameterQualifiers: readonly string[] = [
  'const',
  'volatile',
  'signed',
  'unsigned',
  'struct',
  'class',
  'typename',
];

export interface RuntimeFunctionMacro {
  parameters: string[];
  expression: string;
}

export class GeometryRuntime {
  // C++ private members; ExprParser and RuntimeExecutor are friends of
  // GeometryRuntime, so these are reachable from those classes.
  /** @internal */ m_values = new Map<string, RuntimeValue>();
  /** @internal */ m_variableIds = new Map<string, number>();
  /** @internal */ m_nextVariableId = 0;
  /** @internal */ m_userVariableOrder: string[] = [];
  /** @internal */ m_diagnostics: RuntimeDiagnostic[] = [];
  /** @internal */ m_variableChanges: RuntimeVariableChange[] = [];
  /** @internal */ m_lastChangedLine = new Map<string, number>();
  /** @internal */ m_apiCalls: RuntimeApiCall[] = [];
  /** @internal */ m_parameterRequests: RuntimeParameterRequest[] = [];
  /** @internal */ m_parameters = new Map<string, string>();
  /** @internal */ m_functionMacros = new Map<string, RuntimeFunctionMacro>();

  discoverParameters(code: string): RuntimeParameterRequest[] {
    return scanGetValParameters(code);
  }

  setParameters(parameters: ReadonlyMap<string, string>): void {
    this.m_parameters = new Map(parameters);
  }

  /**
   * Evaluate a Link field against the current execution state, without changing it.
   * Numeric get_val keys are also available as aliases of their target variables.
   */
  evaluateNumericExpression(expression: string): number {
    const snapshot = new GeometryRuntime();
    for (const [name, value] of this.m_values) snapshot.m_values.set(name, runtimeDeepCopy(value));
    snapshot.m_functionMacros = new Map(this.m_functionMacros);
    for (const request of this.m_parameterRequests) {
      if (this.m_values.has(request.variableName) && !snapshot.m_values.has(request.name))
        snapshot.m_values.set(request.name, runtimeDeepCopy(this.m_values.get(request.variableName)));
    }
    const field = trim(expression);
    if (field === '') throw runtimeError('enter a number, variable or expression');
    let value: RuntimeValue;
    if (snapshot.m_values.has(field)) value = snapshot.m_values.get(field);
    else {
      const lexer = new Lexer(field);
      const tokens = lexer.scan();
      if (tokens.length !== 0 && tokens[tokens.length - 1].kind === TokKind.End) tokens.pop();
      value = new ExprParser(tokens, snapshot).parse();
    }
    const number = runtimeNumber(value);
    if (!Number.isFinite(number)) throw runtimeError('value must be finite');
    return number;
  }

  executeUpToLine(code: string, maxLine: number): RuntimeResult {
    this.m_values = new Map();
    this.m_variableIds = new Map();
    this.m_nextVariableId = 0;
    this.m_userVariableOrder = [];
    this.m_diagnostics = [];
    this.m_variableChanges = [];
    this.m_lastChangedLine = new Map();
    this.m_apiCalls = [];
    this.m_parameterRequests = [];
    this.m_functionMacros = new Map();

    this.setVariable('vx', new FdVector3d(1, 0, 0), false);
    this.setVariable('vy', new FdVector3d(0, 1, 0), false);
    this.setVariable('vz', new FdVector3d(0, 0, 1), false);
    // SDK defaults are available before source macros and declarations. Preserve
    // their published precision, particularly the tolerance-adjusted ARX_PI.
    for (const constant of kSdkConstants)
      this.setVariable(constant.name, constant.integer ? doubleToInt64(constant.value) : constant.value, false);
    // Default preview complexity; source code can still override it.
    this.setVariable('cpx', 10n, false);
    this.setVariable('m_geoRepMode', 0n, false);
    this.setVariable('m_primitiveMode', 0n, false);

    // Import lightweight object-like and expression-style function-like macros
    // from the source itself. This avoids project-specific macro names in the
    // runtime (for example SEGNUM) while keeping macro evaluation deterministic.
    {
      for (const lineText of code.split('\n')) {
        const line = trim(lineText);
        if (!line.startsWith('#define')) continue;
        const definition = trim(line.slice(7));
        if (definition === '') continue;

        let nameEnd = 0;
        while (nameEnd < definition.length && (isalnum(definition[nameEnd]) || definition[nameEnd] === '_')) ++nameEnd;
        if (nameEnd === 0) continue;
        const macroName = definition.slice(0, nameEnd);

        if (nameEnd < definition.length && definition[nameEnd] === '(') {
          const close = definition.indexOf(')', nameEnd + 1);
          if (close === -1) continue;
          const macro: RuntimeFunctionMacro = { parameters: [], expression: '' };
          const paramsText = definition.slice(nameEnd + 1, close);
          for (let param of paramsText.split(',')) {
            param = trim(param);
            if (param !== '') macro.parameters.push(param);
          }
          macro.expression = trim(definition.slice(close + 1));
          if (macro.expression !== '') this.m_functionMacros.set(macroName, macro);
          continue;
        }

        const expression = trim(definition.slice(nameEnd));
        if (expression === '') continue;
        try {
          const macroLexer = new Lexer(expression);
          const tokens = macroLexer.scan();
          if (tokens.length !== 0 && tokens[tokens.length - 1].kind === TokKind.End) tokens.pop();
          const value = new ExprParser(tokens, this).parse();
          this.setVariable(macroName, value, false);
        } catch (e) {
          stdException(e);
          // Macros requiring unsupported compiler/preprocessor features
          // remain unresolved and will surface as a normal diagnostic.
        }
      }
    }

    try {
      // Parse exactly the C++ source supplied by the user. Project-specific
      // function bodies are never injected into the preview runtime.
      const parseCode = code;
      const lexer = new Lexer(parseCode);
      const parser = new ProgramParser(lexer.scan());
      const program = parser.parse();
      let originalLineCount = 1;
      for (let i = 0; i < code.length; ++i) if (code[i] === '\n') ++originalLineCount;
      const effectiveMaxLine = Math.min(Math.max(0, maxLine), originalLineCount);
      const executor = new RuntimeExecutor(this, effectiveMaxLine);
      executor.executeProgram(program);
    } catch (e) {
      this.addDiagnostic(Math.max(1, maxLine), 'parser: ' + stdException(e).message);
    }

    const result: RuntimeResult = {
      variables: [],
      variableChanges: this.m_variableChanges.slice(),
      diagnostics: this.m_diagnostics.slice(),
      apiCalls: this.m_apiCalls.slice(),
      parameterRequests: this.m_parameterRequests.slice(),
    };

    const appendValue = (name: string, value: RuntimeValue, depth: number): void => {
      const changed = this.m_lastChangedLine.get(name);
      result.variables.push({
        name,
        value: runtimeDeepCopy(value),
        lastChangedLine: changed === undefined ? 0 : changed,
      });
      if (depth > 4) return;
      if (!isArray(value)) return;
      const array = value;
      const limit = Math.min(array.elements.length, 64);
      for (let i = 0; i < limit; ++i) appendValue(`${name}[${i}]`, array.elements[i], depth + 1);
    };

    for (const name of this.m_userVariableOrder) {
      if (this.m_values.has(name)) appendValue(name, this.m_values.get(name), 0);
    }
    return result;
  }

  /** @internal */
  lookupValue(name: string): RuntimeValue {
    if (!this.m_values.has(name)) throw runtimeError('unknown variable: ' + name);
    return runtimeDeepCopy(this.m_values.get(name));
  }

  /** @internal */
  captureValueSources(expression: string): RuntimeValueSource[] {
    const sources: RuntimeValueSource[] = [];
    const tokens = new Lexer(expression).scan();
    for (let i = 0; i < tokens.length; ++i) {
      if (tokens[i].kind !== TokKind.Identifier) continue;
      if (i > 0 && (isSymbol(tokens[i - 1], '.') || isSymbol(tokens[i - 1], '::'))) continue;
      let root = tokens[i].text;
      let p = i + 1;
      while (p + 1 < tokens.length && isSymbol(tokens[p], '::') && tokens[p + 1].kind === TokKind.Identifier) {
        root += '::' + tokens[p + 1].text;
        p += 2;
      }
      if (!this.m_values.has(root)) continue;
      let path = root;
      let value = this.m_values.get(root);
      while (p < tokens.length) {
        if (isSymbol(tokens[p], '[')) {
          const begin = ++p;
          let depth = 1;
          while (p < tokens.length && depth > 0) {
            if (isSymbol(tokens[p], '[')) ++depth;
            else if (isSymbol(tokens[p], ']')) --depth;
            if (depth === 0) break;
            ++p;
          }
          if (depth !== 0) break;
          const indexTokens = sliceTokens(tokens, begin, p);
          // Trace capture must never execute a function or mutate state.
          const pureIndex = indexTokens.every(
            (t) =>
              t.kind === TokKind.Number ||
              t.kind === TokKind.Identifier ||
              (t.kind === TokKind.Symbol &&
                (t.text === '+' || t.text === '-' || t.text === '*' || t.text === '/' || t.text === '%')),
          );
          if (!pureIndex) break;
          try {
            const index = runtimeInteger(new ExprParser(indexTokens, this).parse());
            if (isArray(value)) {
              const array = value;
              if (index < 0n || index >= BigInt(array.elements.length)) break;
              value = array.elements[Number(index)];
              path += `[${index}]`;
            } else if (index >= 0n && index < 3n && (isPoint(value) || isVector(value))) {
              const component = 'xyz'[Number(index)];
              value = index === 0n ? value.x : index === 1n ? value.y : value.z;
              path += '.' + component;
            } else break;
          } catch (e) {
            stdException(e);
            break;
          }
          ++p;
        } else if (
          isSymbol(tokens[p], '.') &&
          p + 1 < tokens.length &&
          (tokens[p + 1].text === 'x' || tokens[p + 1].text === 'y' || tokens[p + 1].text === 'z')
        ) {
          const member = tokens[p + 1].text;
          if (isPoint(value) || isVector(value)) value = member === 'x' ? value.x : member === 'y' ? value.y : value.z;
          else break;
          path += '.' + member;
          p += 2;
        } else break;
      }
      if (sources.some((s) => s.name === path)) continue;
      const id = this.m_variableIds.get(root);
      sources.push({
        name: path,
        value: runtimeDeepCopy(value),
        variableId: id === undefined ? -1 : id,
        historyEnd: this.m_variableChanges.length,
      });
    }
    return sources;
  }

  /** @internal */
  captureArgumentTrace(expression: string, value: RuntimeValue, depth = 0): RuntimeArgumentTrace {
    const trace: RuntimeArgumentTrace = { expression, sources: this.captureValueSources(expression), elements: [] };
    if (!isArray(value) || depth >= 4) return trace;
    const array = value;
    const tokens = new Lexer(expression).scan();
    if (tokens.length !== 0 && tokens[tokens.length - 1].kind === TokKind.End) tokens.pop();
    const initializer = tokens.length >= 2 && isSymbol(tokens[0], '{') && isSymbol(tokens[tokens.length - 1], '}');
    const parts = initializer ? splitTopLevel(sliceTokens(tokens, 1, tokens.length - 1), ',') : [];
    for (let i = 0; i < array.elements.length; ++i) {
      const elementExpression = initializer
        ? i < parts.length
          ? tokensToExpression(parts[i])
          : ''
        : expression === ''
          ? ''
          : `${expression}[${i}]`;
      trace.elements.push(this.captureArgumentTrace(elementExpression, array.elements[i], depth + 1));
    }
    return trace;
  }

  /** @internal */
  setVariable(
    name: string,
    value: RuntimeValue,
    userVariable = true,
    line = 0,
    operation = '',
    expression = '',
    inputTrace: RuntimeArgumentTrace | null = null,
  ): void {
    const existed = this.m_values.has(name);
    const newLifetime = !existed || operation === 'declare' || operation === 'bind';
    const before: RuntimeValue = existed && !newLifetime ? runtimeDeepCopy(this.m_values.get(name)) : undefined;
    const trace: RuntimeArgumentTrace = inputTrace
      ? inputTrace
      : line > 0
        ? this.captureArgumentTrace(expression, value)
        : { expression: '', sources: [], elements: [] };
    if (newLifetime) this.m_variableIds.set(name, this.m_nextVariableId++);
    if (userVariable && !existed) this.m_userVariableOrder.push(name);
    this.m_values.set(name, runtimeDeepCopy(value));
    if (line > 0) {
      this.recordVariableChange(
        line,
        name,
        operation === '' ? 'set' : operation,
        expression,
        before,
        this.m_values.get(name),
        trace.sources,
      );
      // Also expose initial array elements as individually inspectable history.
      const addChildren = (base: string, v: RuntimeValue, input: RuntimeArgumentTrace): void => {
        if (!isArray(v)) return;
        const elements = v.elements;
        for (let i = 0; i < elements.length; ++i) {
          const child = `${base}[${i}]`;
          const elementTrace: RuntimeArgumentTrace =
            i < input.elements.length ? input.elements[i] : { expression: '', sources: [], elements: [] };
          this.recordVariableChange(
            line,
            child,
            'declare',
            elementTrace.expression,
            undefined,
            elements[i],
            elementTrace.sources,
          );
          addChildren(child, elements[i], elementTrace);
        }
      };
      if (!existed || operation === 'declare' || operation === 'bind')
        addChildren(name, this.m_values.get(name), trace);
    }
  }

  /** @internal */
  hasVariable(name: string): boolean {
    return this.m_values.has(name);
  }

  /** @internal */
  addDiagnostic(line: number, message: string): void {
    const exists = this.m_diagnostics.some((d) => d.line === line && d.message === message);
    if (!exists) this.m_diagnostics.push({ line, message });
  }

  /** @internal */
  recordApiCall(call: RuntimeApiCall): number {
    // Enforce immutable per-call snapshots, including nested arrays.
    call.arguments = call.arguments.map(runtimeDeepCopy);
    for (let i = 0; i < call.arguments.length; ++i)
      call.argumentTraces.push(
        this.captureArgumentTrace(
          i < call.argumentExpressions.length ? call.argumentExpressions[i] : '',
          call.arguments[i],
        ),
      );
    this.m_apiCalls.push(call);
    return this.m_apiCalls.length - 1;
  }

  /** @internal */
  recordVariableChange(
    line: number,
    name: string,
    operation: string,
    expression: string,
    before: RuntimeValue,
    after: RuntimeValue,
    sources: RuntimeValueSource[] = [],
  ): void {
    if (line <= 0 || name === '') return;
    const cut = name.search(/[[.]/);
    const root = cut === -1 ? name : name.slice(0, cut);
    const id = this.m_variableIds.get(root);
    this.m_variableChanges.push({
      line,
      name,
      operation,
      expression,
      before: runtimeDeepCopy(before),
      after: runtimeDeepCopy(after),
      variableId: id === undefined ? -1 : id,
      sources,
    });
    this.m_lastChangedLine.set(name, line);
    // Changing an array element/member also changes the parent object summary.
    let parent = name;
    while (true) {
      const bracket = parent.lastIndexOf('[');
      const dot = parent.lastIndexOf('.');
      let cutAt = -1;
      if (bracket !== -1) cutAt = bracket;
      if (dot !== -1 && (cutAt === -1 || dot > cutAt)) cutAt = dot;
      if (cutAt === -1) break;
      parent = parent.slice(0, cutAt);
      this.m_lastChangedLine.set(parent, line);
    }
  }

  /** @internal */
  recordParameterRequest(request: RuntimeParameterRequest): void {
    const it = this.m_parameterRequests.findIndex(
      (r) =>
        r.name === request.name &&
        r.sourceFunction === request.sourceFunction &&
        r.variableName === request.variableName,
    );
    if (it === -1) this.m_parameterRequests.push(request);
    else this.m_parameterRequests[it] = request;
  }
}

/** Indices into result.variableChanges that form the history of `source`. */
export function runtimeSourceHistory(result: RuntimeResult, source: RuntimeValueSource): number[] {
  const history: number[] = [];
  if (source.variableId < 0) return history;
  const containsPath = (parent: string, child: string) =>
    child.length > parent.length &&
    child.startsWith(parent) &&
    (child[parent.length] === '[' || child[parent.length] === '.');
  const end = Math.min(source.historyEnd, result.variableChanges.length);
  for (let i = 0; i < end; ++i) {
    const change = result.variableChanges[i];
    if (change.variableId !== source.variableId) continue;
    // Array declarations have individual element records with precise
    // initializer sources. Do not duplicate their aggregate declaration.
    if (
      (change.operation === 'declare' || change.operation === 'bind') &&
      isArray(change.after) &&
      containsPath(change.name, source.name)
    )
      continue;
    if (change.name === source.name || containsPath(change.name, source.name) || containsPath(source.name, change.name))
      history.push(i);
  }
  return history;
}

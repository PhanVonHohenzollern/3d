import { isalnum, isalpha, isdigit, isspace, strtod } from '../../../utils/cpp';
import { makeToken, TokKind, type Token } from '../helpers/tokens';

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
  '<<',
  '>>',
]);
const kSingleCharSymbols = '+-*/%(){}[];,.?:=<>!&|^~';

// strtod only sees the literal's own character run; parsing the whole remaining source made lexing quadratic.
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

export class Lexer {
  private m_pos = 0;
  private m_line = 1;

  constructor(private readonly m_source: string) {}

  static scanExpression(source: string): Token[] {
    const tokens = new Lexer(source).scan();
    tokens.pop();

    return tokens;
  }

  scan(): Token[] {
    const out: Token[] = [];
    this.skipByteOrderMark();
    let lineStart = true;
    while (this.m_pos < this.m_source.length) {
      const c = this.m_source[this.m_pos];
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
        this.skipToLineEnd();
        continue;
      }
      lineStart = false;

      if (c === '/' && this.peek(1) === '/') {
        this.m_pos += 2;
        this.skipToLineEnd();
        continue;
      }
      if (c === '/' && this.peek(1) === '*') {
        this.skipBlockComment();
        continue;
      }
      if (c === '"' || c === "'") {
        out.push(this.scanString(c));
        continue;
      }
      if (c === 'L' && this.peek(1) === '"') {
        ++this.m_pos;
        out.push(this.scanString('"'));
        continue;
      }
      if (isdigit(c) || (c === '.' && isdigit(this.peek(1)))) {
        out.push(this.scanNumber());
        continue;
      }
      if (isalpha(c) || c === '_') {
        out.push(this.scanIdentifier());
        continue;
      }

      const op = this.m_source.slice(this.m_pos, this.m_pos + 2);
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
      ++this.m_pos;
    }
    out.push(makeToken(TokKind.End, '', 0.0, this.m_line));

    return out;
  }

  private skipByteOrderMark(): void {
    const src = this.m_source;
    if (this.m_pos !== 0) return;
    if (src.length >= 1 && src.charCodeAt(0) === 0xfeff) this.m_pos = 1;
    else if (src.length >= 3 && src.charCodeAt(0) === 0xef && src.charCodeAt(1) === 0xbb && src.charCodeAt(2) === 0xbf)
      this.m_pos = 3;
  }

  private skipToLineEnd(): void {
    while (this.m_pos < this.m_source.length && this.m_source[this.m_pos] !== '\n') ++this.m_pos;
  }

  private skipBlockComment(): void {
    const src = this.m_source;
    this.m_pos += 2;
    while (this.m_pos + 1 < src.length && !(src[this.m_pos] === '*' && src[this.m_pos + 1] === '/')) {
      if (src[this.m_pos] === '\n') ++this.m_line;
      ++this.m_pos;
    }
    if (this.m_pos + 1 < src.length) this.m_pos += 2;
  }

  private scanString(quote: string): Token {
    const src = this.m_source;
    const line = this.m_line;
    ++this.m_pos;
    let value = '';
    while (this.m_pos < src.length && src[this.m_pos] !== quote) {
      const d = src[this.m_pos++];
      if (d === '\\' && this.m_pos < src.length) {
        value += unescape(src[this.m_pos++]);
      } else {
        if (d === '\n') ++this.m_line;
        value += d;
      }
    }
    if (this.m_pos < src.length) ++this.m_pos;

    return {
      ...makeToken(TokKind.String, value, 0.0, line),
      ...(quote === "'" && value.length === 1 ? { character: true } : {}),
    };
  }

  private scanNumber(): Token {
    const src = this.m_source;
    const start = this.m_pos;
    const parsed = strtod(src.slice(start, numericRunEnd(src, start)));
    const n = parsed.end;
    this.m_pos += n;
    const hex = n >= 2 && src[start] === '0' && (src[start + 1] === 'x' || src[start + 1] === 'X');
    while (this.m_pos < src.length && isNumericSuffix(src[this.m_pos], hex)) ++this.m_pos;

    return makeToken(TokKind.Number, src.slice(start, this.m_pos), parsed.value, this.m_line);
  }

  private scanIdentifier(): Token {
    const src = this.m_source;
    const start = this.m_pos++;
    while (this.m_pos < src.length && (isalnum(src[this.m_pos]) || src[this.m_pos] === '_')) ++this.m_pos;

    return makeToken(TokKind.Identifier, src.slice(start, this.m_pos), 0.0, this.m_line);
  }

  private peek(offset: number): string {
    const p = this.m_pos + offset;

    return p < this.m_source.length ? this.m_source[p] : '\0';
  }
}

function unescape(e: string): string {
  switch (e) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    default:
      return e;
  }
}

function isNumericSuffix(suffix: string, hex: boolean): boolean {
  return (
    suffix === 'u' || suffix === 'U' || suffix === 'l' || suffix === 'L' || (!hex && (suffix === 'f' || suffix === 'F'))
  );
}

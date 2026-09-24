import { runtimeError } from '../../../utils/cpp';
import { isIdentifier, isSymbol, sliceTokens, splitTopLevel, TokKind, type Token } from '../helpers/tokens';
import { Statement, StatementKind } from './Statement';

export class ProgramParser {
  private m_pos = 0;

  constructor(private readonly m_tokens: Token[]) {}

  parse(): Statement {
    const root = new Statement(StatementKind.Block, 1);
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
    const fn = new Statement(StatementKind.Function, this.current().line);
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
    const block = new Statement(StatementKind.Block, this.current().line);
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
      const e = new Statement(StatementKind.Empty, this.current().line);
      e.endLine = e.startLine;
      this.advance();
      return e;
    }
    if (isSymbol(this.current(), '{')) return this.parseBlock();
    if (allowFunction && this.looksLikeFunctionDefinition()) return this.parseFunction();
    if (isIdentifier(this.current(), 'if')) return this.parseIf();
    if (isIdentifier(this.current(), 'for')) return this.parseFor();
    return this.parseSimple();
  }

  private parseIf(): Statement {
    const s = new Statement(StatementKind.If, this.current().line);
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

  private parseFor(): Statement {
    const s = new Statement(StatementKind.For, this.current().line);
    this.advance();
    const clauses = splitTopLevel(this.readParenthesized(), ';');
    if (clauses.length !== 0) s.forInit = clauses[0];
    if (clauses.length > 1) s.forCondition = clauses[1];
    if (clauses.length > 2) s.forIncrement = clauses[2];
    s.body = this.parseStatement(false);
    s.endLine = s.body ? s.body.endLine : s.startLine;
    return s;
  }

  private parseSimple(): Statement | null {
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
        const s = new Statement(StatementKind.Simple, startLine);
        s.endLine = t.line;
        s.tokens = sliceTokens(this.m_tokens, start, this.m_pos);
        this.advance();
        return s;
      }
      this.advance();
    }
    return null;
  }
}

import { doubleToInt64, runtimeError, stdException, stod, stoll, trim } from '../../../utils/cpp';
import { FdPoint3d, FdVector3d } from '../FdMath';
import { builtinFunction } from '../helpers/builtinFunctions';
import type { RuntimeFunctionMacro } from '../helpers/macros';
import { callMethod, indexValue, memberValue } from '../helpers/pointVectorMembers';
import { makeToken, isIdentifier, isSymbol, TokKind, type Token } from '../helpers/tokens';
import { isNumericType, parseRuntimeType, type ParsedType } from '../helpers/typeNames';
import {
  addValues,
  compareValues,
  divValues,
  equalValues,
  modValues,
  mulValues,
  negateValue,
  subValues,
} from '../helpers/valueOperations';
import {
  isDouble,
  isInt,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeInteger,
  runtimeTruthy,
  type RuntimeValue,
} from '../RuntimeValue';
import { Lexer } from './Lexer';
import type { RuntimeState } from './RuntimeState';

const kEndToken: Token = makeToken(TokKind.End, '', 0.0, 0);

const kScopedConstants: ReadonlyMap<string, () => RuntimeValue> = new Map([
  ['FdVector3d::kXAxis', () => new FdVector3d(1, 0, 0)],
  ['FdVector3d::kYAxis', () => new FdVector3d(0, 1, 0)],
  ['FdVector3d::kZAxis', () => new FdVector3d(0, 0, 1)],
  ['FdVector3d::kIdentity', () => new FdVector3d(0, 0, 0)],
  ['FdPoint3d::kOrigin', () => new FdPoint3d()],
]);

export class ExprParser {
  private m_pos = 0;

  constructor(
    private readonly m_tokens: readonly Token[],
    private readonly m_state: RuntimeState,
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

  private currentIs(...texts: string[]): boolean {
    return !this.atEnd() && texts.includes(this.current().text);
  }

  private match(s: string): boolean {
    if (!this.currentIs(s)) return false;
    ++this.m_pos;

    return true;
  }

  private expect(s: string): void {
    if (!this.match(s)) throw runtimeError(`expected '${s}'`);
  }

  private takeOperator(): string {
    return this.m_tokens[this.m_pos++].text;
  }

  private parseConditional(): RuntimeValue {
    const cond = this.parseLogicalOr();
    if (!this.match('?')) return cond;
    const yes = this.parseConditional();
    this.expect(':');
    const no = this.parseConditional();

    return runtimeTruthy(cond) ? yes : no;
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
    while (this.currentIs('==', '!=')) {
      const op = this.takeOperator();
      const eq = equalValues(lhs, this.parseRelational());
      lhs = op === '==' ? eq : !eq;
    }

    return lhs;
  }

  private parseRelational(): RuntimeValue {
    let lhs = this.parseAdditive();
    while (this.currentIs('<', '>', '<=', '>=')) {
      const op = this.takeOperator();
      lhs = compareValues(op, lhs, this.parseAdditive());
    }

    return lhs;
  }

  private parseAdditive(): RuntimeValue {
    let lhs = this.parseMultiplicative();
    while (this.currentIs('+', '-')) {
      const op = this.takeOperator();
      const rhs = this.parseMultiplicative();
      lhs = op === '+' ? addValues(lhs, rhs) : subValues(lhs, rhs);
    }

    return lhs;
  }

  private parseMultiplicative(): RuntimeValue {
    let lhs = this.parseUnary();
    while (this.currentIs('*', '/', '%')) {
      const op = this.takeOperator();
      const rhs = this.parseUnary();
      if (op === '*') lhs = mulValues(lhs, rhs);
      else if (op === '/') lhs = divValues(lhs, rhs);
      else lhs = modValues(lhs, rhs);
    }

    return lhs;
  }

  private castAhead(): ParsedType | null {
    if (!this.currentIs('(')) return null;
    const parsed = parseRuntimeType(this.m_tokens, this.m_pos + 1);
    if (!parsed || !isNumericType(parsed.type)) return null;

    return parsed.end < this.m_tokens.length && isSymbol(this.m_tokens[parsed.end], ')') ? parsed : null;
  }

  private parseUnary(): RuntimeValue {
    if (this.match('!')) return !runtimeTruthy(this.parseUnary());
    if (this.match('-')) return negateValue(this.parseUnary());
    if (this.match('+')) return this.parseUnary();
    if (!this.atEnd() && isIdentifier(this.current(), 'static_cast')) return this.parseStaticCast();
    const cast = this.castAhead();
    if (cast) {
      this.m_pos = cast.end;
      this.expect(')');

      return runtimeCoerceToType(this.parseUnary(), cast.type);
    }

    return this.parsePrimary();
  }

  private parseStaticCast(): RuntimeValue {
    ++this.m_pos;
    this.expect('<');
    const parsed = parseRuntimeType(this.m_tokens, this.m_pos);
    if (!parsed || !isNumericType(parsed.type)) throw runtimeError('unsupported static_cast type');
    this.m_pos = parsed.end;
    this.expect('>');
    this.expect('(');
    const value = this.parseConditional();
    this.expect(')');

    return runtimeCoerceToType(value, parsed.type);
  }

  private callFreeFunction(name: string, args: readonly RuntimeValue[]): RuntimeValue {
    const builtin = builtinFunction(name);
    if (builtin) return builtin(args);
    const macro = this.m_state.m_functionMacros.get(name);
    if (macro !== undefined) return this.expandFunctionMacro(name, macro, args);
    throw runtimeError('unsupported expression function: ' + name);
  }

  private expandFunctionMacro(name: string, macro: RuntimeFunctionMacro, args: readonly RuntimeValue[]): RuntimeValue {
    if (args.length !== macro.parameters.length)
      throw runtimeError(`macro ${name} expects ${macro.parameters.length} argument(s)`);
    const values = this.m_state.m_values;
    const saved = macro.parameters.map((parameter, i) => {
      const existed = values.has(parameter);
      const value = existed ? runtimeDeepCopy(values.get(parameter)) : undefined;
      values.set(parameter, runtimeDeepCopy(args[i]));

      return { existed, value };
    });
    try {
      return new ExprParser(Lexer.scanExpression(macro.expression), this.m_state).parse();
    } finally {
      macro.parameters.forEach((parameter, i) => {
        if (saved[i].existed) values.set(parameter, saved[i].value);
        else values.delete(parameter);
      });
    }
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

  private parsePostfix(value: RuntimeValue): RuntimeValue {
    while (!this.atEnd()) {
      if (this.match('[')) {
        const idx = this.parseConditional();
        this.expect(']');
        value = indexValue(value, runtimeInteger(idx));
        continue;
      }
      if (this.match('.')) {
        if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected member name after .');
        const member = this.current().text;
        ++this.m_pos;
        value = this.currentIs('(') ? callMethod(value, member, this.parseArguments()) : memberValue(value, member);
        continue;
      }
      break;
    }

    return value;
  }

  private parsePrimary(): RuntimeValue {
    if (this.atEnd()) throw runtimeError('expected expression');
    const token = this.current();
    if (token.kind === TokKind.Number) {
      ++this.m_pos;

      return numberLiteral(token);
    }
    if (token.kind === TokKind.String) {
      ++this.m_pos;

      return token.text;
    }
    if (this.match('(')) {
      const v = this.parseConditional();
      this.expect(')');

      return this.parsePostfix(v);
    }
    if (token.kind !== TokKind.Identifier) throw runtimeError("expected expression near '" + token.text + "'");

    const name = token.text;
    ++this.m_pos;
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'NULL' || name === 'nullptr') return undefined;
    if (
      (name === 'getExtInsSize' || name === 'getIntInsSize') &&
      this.current().text === '(' &&
      this.current(1).kind === TokKind.Identifier &&
      this.current(2).text === ')'
    )
      return this.parseInsulationQuery(name, token.line);
    if (this.match('::')) return this.parseScopedName(name);

    const value = this.currentIs('(')
      ? this.callFreeFunction(name, this.parseArguments())
      : this.m_state.lookupValue(name);

    return this.parsePostfix(value);
  }

  private parseInsulationQuery(name: string, line: number): RuntimeValue {
    ++this.m_pos;
    const destName = this.current().text;
    ++this.m_pos;
    this.expect(')');
    const configured = this.m_state.m_parameters.get(name);
    if (configured === undefined) return false;
    const before = this.m_state.lookupValue(destName);
    let next = before;
    try {
      if (isDouble(before)) next = stod(trim(configured)).value;
      else if (isInt(before)) next = stoll(trim(configured)).value;
    } catch (e) {
      stdException(e);

      return false;
    }
    this.m_state.setVariable(destName, next, true, line, name, configured);

    return true;
  }

  private parseScopedName(name: string): RuntimeValue {
    if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected name after ::');
    let qualified = name + '::' + this.current().text;
    ++this.m_pos;
    const constant = kScopedConstants.get(qualified);
    if (constant) return constant();
    while (this.match('::')) {
      if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected scoped name');
      qualified += '::' + this.current().text;
      ++this.m_pos;
    }
    if (this.currentIs('(') && isNumericType(qualified)) return this.callFreeFunction(qualified, this.parseArguments());

    return this.parsePostfix(this.m_state.lookupValue(qualified));
  }
}

function numberLiteral(token: Token): RuntimeValue {
  const text = token.text;
  const hex = text.length >= 2 && text[0] === '0' && (text[1] === 'x' || text[1] === 'X');
  const exponentChars = hex ? '.pP' : '.eEfF';

  return [...text].some((ch) => exponentChars.includes(ch)) ? token.number : doubleToInt64(token.number);
}

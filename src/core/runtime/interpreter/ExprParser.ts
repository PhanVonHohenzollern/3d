import { doubleToInt64, runtimeError, stdException, stod, stoll, trim } from '../../../utils/cpp';
import { FdPoint3d, FdVector3d } from '../FdMath';
import { isBowlValue } from '../FdBowlData';
import { builtinFunction } from '../helpers/builtinFunctions';
import { createArray } from '../helpers/arrays';
import { kMutatingMethods } from '../helpers/mutatingMethods';
import type { RuntimeFunctionMacro } from '../helpers/macros';
import { callMethod, indexValue, memberValue } from '../helpers/pointVectorMembers';
import { makeToken, isIdentifier, isSymbol, parseCallArguments, TokKind, type Token } from '../helpers/tokens';
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
  private m_evaluate = true;

  private branch(enabled: boolean, parse: () => RuntimeValue): RuntimeValue {
    const previous = this.m_evaluate;
    this.m_evaluate &&= enabled;
    try {
      return parse();
    } finally {
      this.m_evaluate = previous;
    }
  }

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
    const yes = this.branch(runtimeTruthy(cond), () => this.parseConditional());
    this.expect(':');
    const no = this.branch(!runtimeTruthy(cond), () => this.parseConditional());

    return runtimeTruthy(cond) ? yes : no;
  }

  private parseLogicalOr(): RuntimeValue {
    let lhs = this.parseLogicalAnd();
    while (this.match('||')) {
      const rhs = this.branch(!runtimeTruthy(lhs), () => this.parseLogicalAnd());
      lhs = runtimeTruthy(lhs) || runtimeTruthy(rhs);
    }

    return lhs;
  }

  private parseLogicalAnd(): RuntimeValue {
    let lhs = this.parseBitwiseOr();
    while (this.match('&&')) {
      const rhs = this.branch(runtimeTruthy(lhs), () => this.parseBitwiseOr());
      lhs = runtimeTruthy(lhs) && runtimeTruthy(rhs);
    }

    return lhs;
  }

  private parseBitwiseOr(): RuntimeValue {
    let value = this.parseBitwiseXor();
    while (this.match('|')) {
      const right = this.parseBitwiseXor();
      value = this.m_evaluate ? runtimeInteger(value) | runtimeInteger(right) : 0n;
    }

    return value;
  }

  private parseBitwiseXor(): RuntimeValue {
    let value = this.parseBitwiseAnd();
    while (this.match('^')) {
      const right = this.parseBitwiseAnd();
      value = this.m_evaluate ? runtimeInteger(value) ^ runtimeInteger(right) : 0n;
    }

    return value;
  }

  private parseBitwiseAnd(): RuntimeValue {
    let value = this.parseEquality();
    while (this.match('&')) {
      const right = this.parseEquality();
      value = this.m_evaluate ? runtimeInteger(value) & runtimeInteger(right) : 0n;
    }

    return value;
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
    let lhs = this.parseShift();
    while (this.currentIs('<', '>', '<=', '>=')) {
      const op = this.takeOperator();
      const rhs = this.parseShift();
      lhs = this.m_evaluate ? compareValues(op, lhs, rhs) : 0n;
    }

    return lhs;
  }

  private parseShift(): RuntimeValue {
    let value = this.parseAdditive();
    while (this.currentIs('<<', '>>')) {
      const op = this.takeOperator(),
        right = this.parseAdditive();
      if (this.m_evaluate) {
        const shift = runtimeInteger(right);
        if (shift < 0n || shift >= 64n) throw runtimeError('shift count must be between 0 and 63');
        value = op === '<<' ? runtimeInteger(value) << shift : runtimeInteger(value) >> shift;
      }
    }

    return value;
  }

  private parseAdditive(): RuntimeValue {
    let lhs = this.parseMultiplicative();
    while (this.currentIs('+', '-')) {
      const op = this.takeOperator();
      const rhs = this.parseMultiplicative();
      lhs = this.m_evaluate ? (op === '+' ? addValues(lhs, rhs) : subValues(lhs, rhs)) : 0n;
    }

    return lhs;
  }

  private parseMultiplicative(): RuntimeValue {
    let lhs = this.parseUnary();
    while (this.currentIs('*', '/', '%')) {
      const op = this.takeOperator();
      const rhs = this.parseUnary();
      if (!this.m_evaluate) lhs = 0n;
      else if (op === '*') lhs = mulValues(lhs, rhs);
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
    if (this.match('-')) {
      const value = this.parseUnary();

      return this.m_evaluate ? negateValue(value) : 0n;
    }
    if (this.match('~')) {
      const value = this.parseUnary();

      return this.m_evaluate ? ~runtimeInteger(value) : 0n;
    }
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
    if (!this.m_evaluate) return 0n;
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

  private parsePostfix(value: RuntimeValue, reference?: Token[]): RuntimeValue {
    while (!this.atEnd()) {
      const start = this.m_pos;
      if (this.match('[')) {
        const idx = this.parseConditional();
        this.expect(']');
        value = this.m_evaluate ? indexValue(value, runtimeInteger(idx)) : 0n;
        if (reference) reference = [...reference, ...this.m_tokens.slice(start, this.m_pos)];
        continue;
      }
      if (this.match('.')) {
        if (this.current().kind !== TokKind.Identifier) throw runtimeError('expected member name after .');
        const member = this.current().text;
        ++this.m_pos;
        if (this.currentIs('(')) {
          const args = this.parseArguments();
          if (!this.m_evaluate) value = 0n;
          else if (reference && kMutatingMethods.includes(member) && this.m_state.mutateValue)
            value = this.m_state.mutateValue(reference, member, args, this.m_tokens[start].line);
          else value = callMethod(value, member, args);
          if (!kMutatingMethods.includes(member)) reference = undefined;
        } else {
          value = this.m_evaluate ? memberValue(value, member) : 0n;
          if (reference) reference = [...reference, ...this.m_tokens.slice(start, this.m_pos)];
        }
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
      let v = this.parseConditional();
      while (this.match(',')) v = this.parseConditional();
      this.expect(')');

      return this.parsePostfix(v);
    }
    if (token.kind !== TokKind.Identifier) throw runtimeError("expected expression near '" + token.text + "'");

    const name = token.text;
    ++this.m_pos;
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'NULL' || name === 'nullptr') return undefined;
    if (name === 'new') {
      const parsed = parseRuntimeType(this.m_tokens, this.m_pos);
      if (!parsed) throw runtimeError('expected allocated type after new');
      this.m_pos = parsed.end;
      const dims: number[] = [];
      while (this.match('[')) {
        dims.push(Number(runtimeInteger(this.parseConditional())));
        this.expect(']');
      }
      if (dims.length === 0) throw runtimeError('only array allocation is supported');
      if (this.match('(')) this.expect(')');
      if (this.match('{')) this.expect('}');

      return this.m_evaluate ? createArray(parsed.type, dims) : 0n;
    }
    if (
      (name === 'getExtInsSize' || name === 'getIntInsSize') &&
      this.current().text === '(' &&
      this.current(1).kind === TokKind.Identifier &&
      this.current(2).text === ')'
    )
      return this.parseInsulationQuery(name, token.line);
    if (this.match('::')) return this.parseScopedName(name);

    const callable = this.currentIs('(');
    const value = callable
      ? this.parseNamedCall(name, token.line)
      : !this.m_evaluate
        ? 0n
        : isBowlValue(this.m_state.m_values.get(name))
          ? this.m_state.m_values.get(name)
          : this.m_state.lookupValue(name);

    return this.parsePostfix(value, callable ? undefined : [token]);
  }

  private parseNamedCall(name: string, line: number): RuntimeValue {
    if (builtinFunction(name) || this.m_state.m_functionMacros.has(name))
      return this.callFreeFunction(name, this.parseArguments());
    const args = parseCallArguments(this.m_tokens, this.m_pos);
    let depth = 0;
    do {
      const text = this.current().text;
      if (text === '(') ++depth;
      if (text === ')') --depth;
      ++this.m_pos;
    } while (!this.atEnd() && depth > 0);
    if (depth !== 0) throw runtimeError("expected ')' after arguments");
    if (!this.m_evaluate) return 0n;
    if (this.m_state.callFunction) return this.m_state.callFunction(name, args, line);
    throw runtimeError('unsupported expression function: ' + name);
  }

  private parseInsulationQuery(name: string, line: number): RuntimeValue {
    ++this.m_pos;
    const destName = this.current().text;
    ++this.m_pos;
    this.expect(')');
    if (!this.m_evaluate) return false;
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
    if (this.currentIs('('))
      return this.parseNamedCall(qualified.startsWith('std::') ? qualified.slice(5) : qualified, this.current().line);

    return this.parsePostfix(this.m_evaluate ? this.m_state.lookupValue(qualified) : 0n);
  }
}

function numberLiteral(token: Token): RuntimeValue {
  const text = token.text;
  const hex = text.length >= 2 && text[0] === '0' && (text[1] === 'x' || text[1] === 'X');
  const exponentChars = hex ? '.pP' : '.eEfF';

  return [...text].some((ch) => exponentChars.includes(ch)) ? token.number : doubleToInt64(token.number);
}

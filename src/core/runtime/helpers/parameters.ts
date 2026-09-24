import { isInt, isBool, isDouble, isString, runtimeValueToCompactString, type RuntimeValue } from '../RuntimeValue';
import { stdException, stod, stoll, trim } from '../../../utils/cpp';
import { Lexer } from '../interpreter/Lexer';
import type { RuntimeParameterRequest } from '../RuntimeTypes';
import { isScalarTypeToken, normalizedScalarType } from './typeNames';
import { isIdentifier, isSymbol, sliceTokens, splitTopLevel, TokKind, tokensToExpression, type Token } from './tokens';

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

export function scanGetValParameters(code: string): RuntimeParameterRequest[] {
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

export function parameterTextToValue(text: string, current: RuntimeValue): RuntimeValue {
  if (isString(current)) return text;
  if (isBool(current)) {
    const value = trim(text);
    if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
    if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
    return current;
  }
  if (!isInt(current) && !isDouble(current)) return current;
  try {
    const value = trim(text);
    const parsed = isInt(current) ? stoll(value) : stod(value);
    if (parsed.used === value.length) return parsed.value;
  } catch (e) {
    stdException(e);
  }
  return current;
}

export function parameterDisplayText(value: RuntimeValue): string {
  const text = runtimeValueToCompactString(value);
  return isString(value) && text === '""' ? '' : text;
}

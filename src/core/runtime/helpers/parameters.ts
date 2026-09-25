import {
  isInt,
  isBool,
  isDouble,
  isString,
  isArray,
  RuntimeArray,
  runtimeValueToCompactString,
  type RuntimeValue,
} from '../RuntimeValue';
import { stdException, stod, stoll, trim } from '../../../utils/cpp';
import { Lexer } from '../interpreter/Lexer';
import { ProgramParser } from '../interpreter/ProgramParser';
import { StatementKind, type Statement } from '../interpreter/Statement';
import type { RuntimeParameterRequest } from '../RuntimeTypes';
import { isScalarTypeToken, normalizedScalarType } from './typeNames';
import { functionParameters } from './functionSignatures';
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
  let root: Statement;
  try {
    root = new ProgramParser(tokens).parse();
  } catch {
    return scanParameterTokens(tokens, scanScalarDeclarations(tokens));
  }
  const out: RuntimeParameterRequest[] = [];
  type Binding = StaticParameterDecl & { requests: RuntimeParameterRequest[] };

  const walk = (s: Statement, bindings: Map<string, Binding>, functionName = ''): void => {
    if (s.kind === StatementKind.Function) {
      const local = new Map(bindings);
      for (const parameter of functionParameters(s))
        for (const [name, declaration] of scanScalarDeclarations(parameter))
          local.set(name, { ...declaration, requests: [] });
      if (s.body) walk(s.body, local, s.functionName);

      return;
    }
    if (s.kind === StatementKind.Block) {
      const local = new Map(bindings);
      for (const child of s.children)
        for (const [name, declaration] of scanScalarDeclarations(child.tokens))
          local.set(name, { ...declaration, requests: [] });
      for (const child of s.children) walk(child, local, functionName);

      return;
    }
    for (const [name, declaration] of scanScalarDeclarations(s.tokens))
      bindings.set(name, { ...declaration, requests: [] });
    for (const request of scanParameterTokens(s.tokens, bindings)) {
      if (functionName) request.functionName = functionName;
      const existing = out.find(
        (item) =>
          item.name === request.name &&
          (request.sourceFunction === 'getExtInsSize' || item.variableName === request.variableName) &&
          item.functionName === request.functionName,
      );
      if (existing) continue;
      out.push(request);
      bindings.get(request.variableName)?.requests.push(request);
      if (request.type === 'bool') request.checkbox = true;
    }
    // Only boolean use is a checkbox; selectors such as roof_base == 2 remain numeric.
    if (
      s.kind === StatementKind.If &&
      s.condition.every(
        (token) => token.kind === TokKind.Identifier || ['!', '&&', '||', '(', ')'].includes(token.text),
      )
    ) {
      for (const token of s.condition)
        for (const request of bindings.get(token.text)?.requests ?? [])
          if (request.type !== 'string') request.checkbox = true;
    }
    // Queries may also be called directly inside an if condition.
    for (const request of scanParameterTokens(s.condition, bindings)) {
      if (functionName) request.functionName = functionName;
      if (
        !out.some(
          (item) =>
            item.name === request.name &&
            item.functionName === request.functionName &&
            (request.sourceFunction === 'getExtInsSize' || item.variableName === request.variableName),
        )
      )
        out.push(request);
    }
    for (const child of [s.thenBranch, s.elseBranch, s.body]) if (child) walk(child, new Map(bindings), functionName);
  };

  walk(root, new Map());

  return out;
}

function scanParameterTokens(
  tokens: readonly Token[],
  declarations: ReadonlyMap<string, StaticParameterDecl>,
): RuntimeParameterRequest[] {
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

  // Insulation is an optional numeric query: the UI supplies its value only when enabled.
  for (let i = 0; i + 3 < tokens.length; ++i) {
    if (
      !isIdentifier(tokens[i], 'getExtInsSize') ||
      !isSymbol(tokens[i + 1], '(') ||
      tokens[i + 2].kind !== TokKind.Identifier ||
      !isSymbol(tokens[i + 3], ')')
    )
      continue;
    if (['.', '->', '::'].includes(tokens[i - 1]?.text)) continue;
    const variableName = tokens[i + 2].text;
    const defaultValue = declarations.get(variableName)?.defaultValue ?? '0';
    out.push({
      name: 'getExtInsSize',
      type: 'double',
      defaultValue,
      currentValue: defaultValue,
      sourceFunction: 'getExtInsSize',
      variableName,
      line: tokens[i].line,
    });
    break;
  }

  return out;
}

export function parameterTextToValue(text: string, current: RuntimeValue): RuntimeValue {
  if (isArray(current) && ['char', 'WCHAR', 'wchar_t'].includes(current.elementType)) {
    const count = current.elements.length;

    return new RuntimeArray(
      current.elementType,
      current.dimensions,
      Array.from({ length: count }, (_, i) => text[i] ?? '\0'),
    );
  }
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

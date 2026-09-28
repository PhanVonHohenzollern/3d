import { Lexer } from '@engine/runtime/interpreter/Lexer';
import { ProgramParser } from '@engine/runtime/interpreter/ProgramParser';
import { StatementKind, type Statement } from '@engine/runtime/interpreter/Statement';
import type { RuntimeParameterRequest, RuntimeExecutionOptions } from '@engine/runtime/RuntimeTypes';
import { isScalarTypeToken, normalizedScalarType } from '@engine/runtime/helpers/typeNames';
import { functionParameters, functionScope } from '@engine/runtime/helpers/functionSignatures';
import { discoverParameters, isInsulationQuery, type StaticParameterDecl } from '@engine/runtime/intrinsics';
import {
  isSymbol,
  sliceTokens,
  splitTopLevel,
  TokKind,
  type Token,
  scanTopLevel,
} from '@engine/runtime/helpers/tokens';

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

    // The declaration ends at ';', a block, or the bracket that closes around it.
    const end = scanTopLevel(
      tokens,
      begin,
      (t, _i, depth) => depth < 0 || (depth === 0 && (isSymbol(t, '{') || isSymbol(t, ';'))),
    );

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

export function scanGetValParameters(code: string, options?: RuntimeExecutionOptions): RuntimeParameterRequest[] {
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
      if (s.body)
        walk(
          s.body,
          local,
          functionScope(
            s,
            root.children.filter((fn) => fn.kind === StatementKind.Function && fn.functionName === s.functionName),
            options,
          ),
        );

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
          (isInsulationQuery(request.sourceFunction) || item.variableName === request.variableName) &&
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
            (isInsulationQuery(request.sourceFunction) || item.variableName === request.variableName),
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
  return discoverParameters(tokens, declarations);
}

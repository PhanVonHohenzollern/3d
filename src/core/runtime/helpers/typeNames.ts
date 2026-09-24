import { sdkCanonicalType, sdkTypeDefinition } from '../SdkDefinitions';
import { isIdentifier, isSymbol, TokKind, type Token } from './tokens';

export interface ParsedType {
  type: string;
  end: number;
}

export function normalizedScalarType(type: string): string {
  const canonical = sdkCanonicalType(type);
  if (canonical === 'float') return 'double';
  if (canonical === 'char') return 'string';

  return canonical;
}

function isScalarTypeName(name: string): boolean {
  const t = sdkCanonicalType(name);

  return (
    t === 'double' || t === 'float' || t === 'int' || t === 'short' || t === 'long' || t === 'bool' || t === 'char'
  );
}

export function isScalarTypeToken(token: Token): boolean {
  return token.kind === TokKind.Identifier && isScalarTypeName(token.text);
}

export function isNumericType(name: string): boolean {
  const type = sdkCanonicalType(name);

  return (
    type === 'double' || type === 'float' || type === 'int' || type === 'short' || type === 'long' || type === 'bool'
  );
}

export function parseRuntimeType(tokens: readonly Token[], start: number): ParsedType | null {
  let pos = start;

  const skipQualifiers = () => {
    while (
      pos < tokens.length &&
      ['const', 'volatile', 'static', 'constexpr', 'inline', 'extern'].some((q) => isIdentifier(tokens[pos], q))
    )
      ++pos;
  };

  skipQualifiers();
  if (pos >= tokens.length || tokens[pos].kind !== TokKind.Identifier) return null;
  let type = tokens[pos++].text;
  while (pos + 1 < tokens.length && isSymbol(tokens[pos], '::') && tokens[pos + 1].kind === TokKind.Identifier) {
    type += '::' + tokens[pos + 1].text;
    pos += 2;
  }
  if (
    !['auto', 'FdPoint3d', 'FdVector3d', 'FdBowlInfo', 'FdBowlFace', 'FdBowlCorner'].includes(type) &&
    !sdkTypeDefinition(type) &&
    !isScalarTypeName(type)
  )
    return null;
  skipQualifiers();
  if (type === 'char' && pos < tokens.length && isSymbol(tokens[pos], '*')) {
    type = 'char*';
    ++pos;
    skipQualifiers();
  }

  return { type, end: pos };
}

export function isKnownSdkTypedef(tokens: readonly Token[]): boolean {
  const base = parseRuntimeType(tokens, 1);
  if (!base || base.end >= tokens.length) return false;
  let pos = base.end;
  const alias = sdkTypeDefinition(tokens[pos++].text);
  let extent = 0;
  if (pos + 2 < tokens.length && isSymbol(tokens[pos], '[') && isSymbol(tokens[pos + 2], ']')) {
    extent = Math.trunc(tokens[pos + 1].number);
    pos += 3;
  }

  return (
    alias !== undefined &&
    sdkCanonicalType(base.type) === alias.baseType &&
    extent === alias.arrayExtent &&
    pos === tokens.length
  );
}

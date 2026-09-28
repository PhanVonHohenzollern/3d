import {
  functionParameters,
  functionSignature,
  parameterDefaultExpression,
  parameterName,
  parameterSignatureType,
  parameterType,
} from '@engine/runtime/helpers/functionSignatures';
import { TokKind, tokensToExpression } from '@engine/runtime/helpers/tokens';
import { parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import { preprocess } from '@engine/runtime/interpreter/preprocessor';
import { ProgramParser } from '@engine/runtime/interpreter/ProgramParser';
import { Statement, StatementKind } from '@engine/runtime/interpreter/Statement';

export interface FunctionInput {
  name: string;
  type: string;
  kind: 'point' | 'vector' | 'number' | 'text' | 'bool' | 'unsupported';
  initial: string[];
}

export interface FunctionDefinition {
  name: string;
  signature: string;
  inputs: FunctionInput[];
}

export function maskPreprocessorLines(source: string): string {
  try {
    return preprocess(source).maskedCode;
  } catch {
    return source;
  }
}

export function analyzeFunctionDefinition(code: string): FunctionDefinition | null {
  const fn = new ProgramParser(new Lexer(code).scan()).parse().children.find((s) => s.kind === StatementKind.Function);
  if (!fn?.functionName) return null;
  const inputs = functionParameters(fn).map((tokens): FunctionInput => {
    const type = parseRuntimeType(tokens, 0)?.type ?? '';
    const expression = tokensToExpression(parameterDefaultExpression(tokens));
    const kind =
      parameterType(tokens).includes('[') || (parameterType(tokens).includes('*') && type !== 'char*')
        ? 'unsupported'
        : type === 'FdPoint3d'
          ? 'point'
          : type === 'FdVector3d'
            ? 'vector'
            : type === 'char*'
              ? 'text'
              : type === 'bool'
                ? 'bool'
                : ['double', 'float', 'ads_real', 'int', 'short', 'long'].includes(type)
                  ? 'number'
                  : 'unsupported';
    const components = expression
      .match(/(?:FdPoint3d|FdVector3d)\s*\(([^)]*)\)/)?.[1]
      .split(',')
      .map((v) => v.trim());
    const literal = parameterDefaultExpression(tokens)[0];

    return {
      name: parameterName(tokens),
      type: parameterType(tokens),
      kind,
      initial:
        kind === 'point' || kind === 'vector'
          ? [0, 1, 2].map((i) => components?.[i] || '0')
          : [
              kind === 'text' && literal?.kind === TokKind.String
                ? literal.text
                : expression || (kind === 'text' ? '' : kind === 'bool' ? 'false' : '0'),
            ],
    };
  });

  return { name: fn.functionName, signature: functionSignature(fn), inputs };
}

export function declaratorSignature(name: string, declarator: string): string {
  const fn = new Statement(StatementKind.Function);
  fn.functionName = name;
  fn.signature = Lexer.scanExpression(declarator);

  return functionSignature(fn);
}

export function containsCode(text: string): boolean {
  return new Lexer(text).scan().length > 1;
}

export function normalizedParameterType(type: string): string {
  return parameterSignatureType(Lexer.scanExpression(type));
}

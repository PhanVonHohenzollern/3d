import { cppLanguage } from '@codemirror/lang-cpp';
import { Lexer } from '../core/runtime/interpreter/Lexer';
import { ProgramParser } from '../core/runtime/interpreter/ProgramParser';
import { StatementKind } from '../core/runtime/interpreter/Statement';
import {
  functionParameters,
  parameterDefaultExpression,
  parameterName,
  parameterType,
} from '../core/runtime/helpers/functionSignatures';
import { TokKind, tokensToExpression } from '../core/runtime/helpers/tokens';
import { parseRuntimeType } from '../core/runtime/helpers/typeNames';

export interface FunctionInput {
  name: string;
  type: string;
  kind: 'point' | 'vector' | 'number' | 'text' | 'bool' | 'unsupported';
  initial: string[];
}

export interface SourceFunction {
  name: string;
  code: string;
  from: number;
  to: number;
  inputs: FunctionInput[];
}

export function declaredFunctionNames(source: string): Set<string> {
  const names = new Set<string>();
  cppLanguage.parser.parse(source).iterate({
    enter(node) {
      if (node.name !== 'FunctionDeclarator') return;
      const name = node.node.getChild('Identifier');
      if (name) names.add(source.slice(name.from, name.to));
    },
  });

  return names;
}

export function mainFunctionName(source: string): string | null {
  for (let node = cppLanguage.parser.parse(source).topNode.firstChild; node; node = node.nextSibling)
    if (node.name.endsWith('Statement') && node.name !== 'EmptyStatement') return null;

  return sourceFunctions(source)[0]?.name ?? null;
}

export function sourceFunctions(source: string): SourceFunction[] {
  const functions: SourceFunction[] = [];
  cppLanguage.parser.parse(source).iterate({
    enter(node) {
      if (node.name !== 'FunctionDefinition') return;
      const code = source.slice(node.from, node.to);
      try {
        const fn = new ProgramParser(new Lexer(code).scan())
          .parse()
          .children.find((s) => s.kind === StatementKind.Function);
        if (!fn?.functionName) return false;
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
        functions.push({ name: fn.functionName, code, from: node.from, to: node.to, inputs });
      } catch {
        // Keep the editor usable while a definition is incomplete.
      }

      return false;
    },
  });

  return functions;
}

export function validFunctionCode(code: string, name: string): string | null {
  let malformed = false;
  cppLanguage.parser.parse(code).iterate({
    enter(node) {
      if (node.type.isError) malformed = true;
    },
  });
  const functions = sourceFunctions(code);
  if (malformed || functions.length !== 1 || functions[0].name !== name)
    return `Enter one complete function named ${name}.`;
  const remaining = code.slice(0, functions[0].from) + code.slice(functions[0].to);
  if (new Lexer(remaining).scan().length > 1) return 'Keep only this function in its editor.';

  return null;
}

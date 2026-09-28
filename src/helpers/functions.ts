import { cppLanguage } from '@codemirror/lang-cpp';
import {
  analyzeFunctionDefinition,
  containsCode,
  declaratorSignature,
  maskPreprocessorLines,
  type FunctionInput,
} from '@engine/runtime';

export type { FunctionInput };

export interface SourceFunction {
  name: string;
  signature: string;
  code: string;
  from: number;
  to: number;
  inputs: FunctionInput[];
}

export function declaredFunctionNames(source: string): Set<string> {
  const names = new Set<string>();
  cppLanguage.parser.parse(maskPreprocessorLines(source)).iterate({
    enter(node) {
      if (node.name !== 'FunctionDeclarator') return;
      const name = node.node.getChild('Identifier');
      if (name) names.add(source.slice(name.from, name.to));
    },
  });

  return names;
}

export function mainFunctionName(source: string): string | null {
  for (
    let node = cppLanguage.parser.parse(maskPreprocessorLines(source)).topNode.firstChild;
    node;
    node = node.nextSibling
  )
    if (node.name.endsWith('Statement') && node.name !== 'EmptyStatement') return null;

  return sourceFunctions(source)[0]?.name ?? null;
}

export function removeFunctionSource(source: string, name: string, signature?: string): string {
  const ranges = sourceFunctions(source)
    .filter((fn) => fn.name === name && (!signature || fn.signature === signature))
    .map(({ from, to }) => ({ from, to }));
  // Remove matching forward declarations, preserving other declarations in the same statement.
  for (
    let node = cppLanguage.parser.parse(maskPreprocessorLines(source)).topNode.firstChild;
    node;
    node = node.nextSibling
  ) {
    if (node.name !== 'Declaration') continue;
    for (const declaration of node.getChildren('FunctionDeclarator')) {
      const identifier = declaration.getChild('Identifier');
      if (!identifier || source.slice(identifier.from, identifier.to) !== name) continue;
      if (signature && declaratorSignature(name, source.slice(declaration.from, declaration.to)) !== signature)
        continue;
      const next = declaration.nextSibling,
        previous = declaration.prevSibling;
      ranges.push(
        next?.name === ','
          ? { from: declaration.from, to: next.to }
          : previous?.name === ','
            ? { from: previous.from, to: declaration.to }
            : { from: node.from, to: node.to },
      );
    }
  }
  const merged: { from: number; to: number }[] = [];
  for (const range of ranges.sort((a, b) => a.from - b.from)) {
    const last = merged.at(-1);
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  for (const { from, to } of merged.reverse()) source = source.slice(0, from) + source.slice(to);

  return source;
}

export function sourceFunctions(source: string): SourceFunction[] {
  const functions: SourceFunction[] = [];
  const parseSource = maskPreprocessorLines(source);
  cppLanguage.parser.parse(parseSource).iterate({
    enter(node) {
      if (node.name !== 'FunctionDefinition') return;
      const code = source.slice(node.from, node.to);
      try {
        const fn = analyzeFunctionDefinition(parseSource.slice(node.from, node.to));
        if (!fn) return false;
        functions.push({ ...fn, code, from: node.from, to: node.to });
      } catch {
        // Keep the editor usable while a definition is incomplete.
      }

      return false;
    },
  });

  return functions;
}

export function validFunctionCode(code: string, name?: string): string | null {
  let malformed = false;
  cppLanguage.parser.parse(maskPreprocessorLines(code)).iterate({
    enter(node) {
      if (node.type.isError) malformed = true;
    },
  });
  const functions = sourceFunctions(code);
  if (malformed || functions.length !== 1 || (name !== undefined && functions[0].name !== name))
    return name ? `Enter one complete function named ${name}.` : 'Enter one complete C++ function.';
  const remaining = code.slice(0, functions[0].from) + code.slice(functions[0].to);
  if (containsCode(remaining)) return 'Keep only this function in its editor.';

  return null;
}

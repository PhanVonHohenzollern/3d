import { cppLanguage } from '@codemirror/lang-cpp';
import { sourceFunctions } from '@/entities/source-function';
import { declaratorSignature, maskPreprocessorLines } from '@engine/runtime';

export interface LibrarySource {
  name: string;
  code: string;
}

const predefinedNames = new Set(['vx', 'vy', 'vz', 'SEGNUM', 'RCFlange', 'cpx', 'concpx']);

export function decodeLibraryAsset(bytes: Uint8Array): string {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';

  return new TextDecoder(encoding).decode(bytes);
}

function withoutComments(code: string): string {
  return code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, (text) =>
    text.startsWith('/') ? text.replace(/[^\r\n]/g, ' ') : text,
  );
}

export function prepareElementSource(files: readonly LibrarySource[], entry: string): LibrarySource[] {
  const definitions = files.flatMap((file) => sourceFunctions(file.code).map((fn) => ({ ...fn, file: file.name })));
  const main = definitions.find((fn) => fn.name === entry && !fn.inputs.length);
  if (!main) throw new Error(`Missing element definition: ${entry}`);
  const needed = new Set([entry]);
  for (const name of needed) {
    for (const fn of definitions.filter((fn) => fn.name === name)) {
      const calls = new Set([...withoutComments(fn.code).matchAll(/\b(\w+)\s*\(/g)].map((match) => match[1]));
      for (const candidate of definitions) if (calls.has(candidate.name)) needed.add(candidate.name);
    }
  }
  const prepared: LibrarySource[] = [{ name: '', code: main.code }];
  const headers = new Map<string, string[]>();
  const sources = new Map<string, string[]>();
  const declared = new Set<string>();
  const prototypes: { file: string; signature: string; code: string }[] = [];

  function append(target: Map<string, string[]>, file: string, code: string): void {
    if (!code.trim()) return;
    const parts = target.get(file) ?? [];
    parts.push(code);
    target.set(file, parts);
  }

  for (const file of files) {
    const declarations: string[] = [];
    const masked = maskPreprocessorLines(file.code);
    const tree = cppLanguage.parser.parse(masked);
    const header = file.name.replace(/\.(h|cpp)$/i, '.h');
    const source = file.name.replace(/\.(h|cpp)$/i, '.cpp');
    tree.iterate({
      enter(cursor) {
        const node = cursor.node;
        const declarator = node.getChild('FunctionDeclarator');
        const identifier = declarator?.getChild('FieldIdentifier') ?? declarator?.getChild('Identifier');
        let owner = node.parent;
        while (owner && owner.name !== 'ClassSpecifier') owner = owner.parent;
        const ownerName = owner?.getChild('TypeIdentifier');

        const qualify = (code: string): string => {
          if (!identifier) return code;
          const name = file.code.slice(identifier.from, identifier.to);
          const className = ownerName
            ? file.code.slice(ownerName.from, ownerName.to)
            : definitions.find((fn) => fn.name === name)?.code.match(/\b(\w+)\s*::\s*\w+\s*\(/)?.[1];
          if (!className) return code;
          const offset = identifier.from - node.from;

          return code.slice(0, offset) + className + '::' + code.slice(offset);
        };

        if (node.name === 'FunctionDefinition') {
          const fn = definitions.find((item) => item.file === file.name && item.from === node.from);
          if (fn && fn !== main && needed.has(fn.name)) {
            append(sources, source, qualify(fn.code));
            const body = node.getChild('CompoundStatement');
            if (body)
              prototypes.push({
                file: header,
                signature: fn.signature,
                code: qualify(file.code.slice(node.from, body.from)).trim() + ';',
              });
          }

          return false;
        }
        if (node.name !== 'Declaration' && node.name !== 'FieldDeclaration') return;
        const code = file.code.slice(node.from, node.to);
        const variables = node.getChildren('InitDeclarator').map((item) => item.getChild('Identifier'));
        const predefined =
          variables.length > 0 &&
          variables.every(
            (identifier) => identifier !== null && predefinedNames.has(file.code.slice(identifier.from, identifier.to)),
          );
        if (declarator) {
          const nameNode = identifier ?? declarator.getChild('ScopedIdentifier')?.lastChild;
          if (!nameNode) return false;
          const name = file.code.slice(nameNode.from, nameNode.to);
          if (name !== entry && needed.has(name)) {
            declared.add(declaratorSignature(name, file.code.slice(declarator.from, declarator.to)));
            append(headers, header, qualify(code));
          }
        } else if (
          node.parent?.name === 'Program' &&
          !/\b(?:__GEO_NAME|__GEO_FN|__COUNT_FN|geometry_fn)\b/.test(withoutComments(code)) &&
          !predefined
        ) {
          declarations.push(code);
        }

        return false;
      },
    });
    const uncommented = withoutComments(file.code);
    const guard = uncommented.match(
      /^\s*#\s*(?:ifndef\s+(\w+)|if\s+!\s*defined\s*(?:\(\s*(\w+)\s*\)|(\w+)))[\t ]*\r?\n/,
    );
    const guardName = guard?.[1] ?? guard?.[2] ?? guard?.[3];
    const macros = (uncommented.match(/^[\t ]*#\s*define\b[^\n]*(?:\\\r?\n[^\n]*)*/gm) ?? []).filter((macro) => {
      const name = macro.match(/#\s*define\s+(\w+)/)?.[1] ?? '';

      return name !== guardName && !predefinedNames.has(name);
    });
    const preamble = [...macros, ...declarations].join('\n\n');
    if (file.name === main.file) prepared[0].code = [preamble, main.code].filter(Boolean).join('\n\n');
    else if (preamble) {
      const target = file.name.endsWith('.h') ? headers : sources;
      target.set(file.name, [preamble, ...(target.get(file.name) ?? [])]);
    }
  }
  for (const prototype of prototypes)
    if (!declared.has(prototype.signature)) append(headers, prototype.file, prototype.code);
  for (const [name, parts] of [...headers, ...sources]) prepared.push({ name, code: parts.join('\n\n') });

  return prepared;
}

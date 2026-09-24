import { isalnum, trim } from '../../../utils/cpp';

export interface RuntimeFunctionMacro {
  parameters: string[];
  expression: string;
}

export type MacroDefinition =
  | { kind: 'function'; name: string; macro: RuntimeFunctionMacro }
  | { kind: 'object'; name: string; expression: string };

export function parseMacroDefinition(lineText: string): MacroDefinition | null {
  const line = trim(lineText);
  if (!line.startsWith('#define')) return null;
  const definition = trim(line.slice(7));
  if (definition === '') return null;

  let nameEnd = 0;
  while (nameEnd < definition.length && (isalnum(definition[nameEnd]) || definition[nameEnd] === '_')) ++nameEnd;
  if (nameEnd === 0) return null;
  const name = definition.slice(0, nameEnd);

  if (nameEnd < definition.length && definition[nameEnd] === '(') {
    const close = definition.indexOf(')', nameEnd + 1);
    if (close === -1) return null;
    const parameters = definition
      .slice(nameEnd + 1, close)
      .split(',')
      .map(trim)
      .filter((param) => param !== '');
    const expression = trim(definition.slice(close + 1));

    return expression === '' ? null : { kind: 'function', name, macro: { parameters, expression } };
  }

  const expression = trim(definition.slice(nameEnd));

  return expression === '' ? null : { kind: 'object', name, expression };
}

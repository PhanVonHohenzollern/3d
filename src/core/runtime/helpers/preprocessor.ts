import { runtimeError } from '../../../utils/cpp';
import { ExprParser } from '../interpreter/ExprParser';
import { Lexer } from '../interpreter/Lexer';
import { RuntimeState } from '../interpreter/RuntimeState';
import { runtimeTruthy } from '../RuntimeValue';
import { parseCallArguments, TokKind, tokensToExpression, type Token } from './tokens';

interface Macro {
  parameters?: string[];
  body: Token[];
}

// Keep one output line per input line: diagnostics and cursor execution use source line numbers.
export function preprocess(code: string): { code: string; definitions: string[] } {
  const macros = new Map<string, Macro>();
  const stack: { parent: boolean; taken: boolean; active: boolean; sawElse: boolean }[] = [];

  const active = () => stack.at(-1)?.active ?? true;

  const expand = (tokens: readonly Token[], disabled = new Set<string>(), depth = 0): Token[] => {
    if (depth > 64) throw runtimeError('macro expansion exceeded 64 levels');
    const result: Token[] = [];
    for (let i = 0; i < tokens.length; ++i) {
      const token = tokens[i],
        macro = token.kind === TokKind.Identifier ? macros.get(token.text) : undefined;
      if (!macro || disabled.has(token.text)) {
        result.push(token);
        continue;
      }
      let body = macro.body;
      if (macro.parameters) {
        if (tokens[i + 1]?.text !== '(') {
          result.push(token);
          continue;
        }
        const args = parseCallArguments(tokens, i + 1);
        if (args.length !== macro.parameters.length) throw runtimeError(`macro ${token.text}: invalid argument count`);
        let nesting = 0;
        do {
          ++i;
          if (tokens[i]?.text === '(') ++nesting;
          if (tokens[i]?.text === ')') --nesting;
        } while (i + 1 < tokens.length && nesting > 0);
        body = body.flatMap((t) => {
          const index = t.kind === TokKind.Identifier ? macro.parameters!.indexOf(t.text) : -1;

          return index < 0 ? [t] : expand(args[index], disabled, depth + 1);
        });
      }
      result.push(...expand(body, new Set([...disabled, token.text]), depth + 1));
    }

    return result;
  };

  const condition = (text: string): boolean => {
    text = text.replace(/\bdefined\s*(?:\(\s*(\w+)\s*\)|(\w+))/g, (_all, a: string, b: string) =>
      macros.has(a ?? b) ? '1' : '0',
    );
    const tokens = expand(Lexer.scanExpression(text)).map((token) =>
      token.kind === TokKind.Identifier ? { ...token, kind: TokKind.Number, text: '0', number: 0 } : token,
    );

    return runtimeTruthy(new ExprParser(tokens, new RuntimeState()).parse());
  };

  const source = code
    .replace(/^\uFEFF|^\u00EF\u00BB\u00BF/, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, (text) =>
      text.startsWith('/') ? text.replace(/[^\r\n]/g, ' ') : text,
    );

  const serialize = (tokens: readonly Token[]) =>
    tokens.map((token) => (token.kind === TokKind.String ? JSON.stringify(token.text) : token.text)).join(' ');

  const lines = source.split('\n');
  const output: string[] = [];
  for (let index = 0; index < lines.length; ++index) {
    let line = lines[index],
      consumed = 0;
    while (/\\\s*$/.test(line) && index + 1 < lines.length) {
      line = line.replace(/\\\s*$/, '') + lines[++index];
      ++consumed;
    }
    const directive = /^\s*#\s*(\w+)\b([\s\S]*)$/.exec(line);
    if (!directive) {
      if (!active()) output.push('');
      else {
        const tokens = Lexer.scanExpression(line),
          expanded = expand(tokens);
        output.push(
          expanded.length === tokens.length && expanded.every((token, i) => token === tokens[i])
            ? line
            : serialize(expanded),
        );
      }
    } else {
      const [, name, rest] = directive;
      const text = rest.replace(/\/\/.*$/, '').trim();
      if (['if', 'ifdef', 'ifndef'].includes(name)) {
        const parent = active();
        const yes = parent && (name === 'if' ? condition(text) : macros.has(text) === (name === 'ifdef'));
        stack.push({ parent, taken: yes, active: yes, sawElse: false });
      } else if (name === 'elif' || name === 'else') {
        const frame = stack.at(-1);
        if (!frame || frame.sawElse) throw runtimeError(`unexpected #${name} at line ${index + 1}`);
        frame.active = frame.parent && !frame.taken && (name === 'else' || condition(text));
        frame.taken ||= frame.active;
        frame.sawElse = name === 'else';
      } else if (name === 'endif') {
        if (!stack.pop()) throw runtimeError(`unexpected #endif at line ${index + 1}`);
      } else if (active() && name === 'define') {
        const match = /^(\w+)(\(([^)]*)\))?\s*(.*)$/.exec(text);
        if (match)
          macros.set(match[1], {
            parameters: match[2]
              ? match[3]
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
            body: Lexer.scanExpression(match[4]),
          });
      } else if (active() && name === 'undef') macros.delete(text);
      else if (active() && name === 'error') throw runtimeError(`#error ${text}`);
      output.push('');
    }
    for (let i = 0; i < consumed; ++i) output.push('');
  }
  if (stack.length) throw runtimeError('unterminated conditional preprocessor directive');

  return {
    code: output.join('\n'),
    definitions: [...macros].map(
      ([name, macro]) =>
        '#define ' +
        name +
        (macro.parameters ? '(' + macro.parameters.join(',') + ')' : '') +
        ' ' +
        tokensToExpression(macro.body),
    ),
  };
}

import { stdException } from '@engine/runtime/cpp/cpp';
import { braceListItems, isBraceList } from '@engine/runtime/helpers/arrays';
import { isSymbol, TokKind, tokensToExpression, type Token } from '@engine/runtime/helpers/tokens';
import type { EvalContext } from '@engine/runtime/interpreter/evalContext';
import { pathSteps } from '@engine/runtime/interpreter/paths';
import { evaluateExpression } from '@engine/runtime/interpreter/evaluator';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import type { RuntimeArgumentTrace, RuntimeValueSource } from '@engine/runtime/RuntimeTypes';
import {
  isArray,
  isPoint,
  isVector,
  runtimeDeepCopy,
  runtimeInteger,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';

// Which variables an expression read, for the API trace's "where did this value come from".

// What source tracing may read from the run's state.
export interface SourceView {
  readonly context: EvalContext;
  value(name: string): RuntimeValue;
  has(name: string): boolean;
  variableId(name: string): number;
  readonly historyLength: number;
}

const isPureIndexToken = (t: Token): boolean =>
  t.kind === TokKind.Number ||
  t.kind === TokKind.Identifier ||
  (t.kind === TokKind.Symbol &&
    (t.text === '+' || t.text === '-' || t.text === '*' || t.text === '/' || t.text === '%'));

const kLexed = new Map<string, readonly Token[]>();

// Tracing lexes the same few expressions over and over inside loops.
function lexed(expression: string): readonly Token[] {
  let tokens = kLexed.get(expression);
  if (!tokens) {
    if (kLexed.size >= 1024) kLexed.clear();
    tokens = new Lexer(expression).scan();
    kLexed.set(expression, tokens);
  }

  return tokens;
}

export function captureValueSources(expression: string, view: SourceView): RuntimeValueSource[] {
  const sources: RuntimeValueSource[] = [];
  const tokens = lexed(expression);
  for (let i = 0; i < tokens.length; ++i) {
    if (tokens[i].kind !== TokKind.Identifier) continue;
    if (i > 0 && (isSymbol(tokens[i - 1], '.') || isSymbol(tokens[i - 1], '::'))) continue;
    let root = tokens[i].text;
    let p = i + 1;
    while (p + 1 < tokens.length && isSymbol(tokens[p], '::') && tokens[p + 1].kind === TokKind.Identifier) {
      root += '::' + tokens[p + 1].text;
      p += 2;
    }
    if (!view.has(root)) continue;
    const { path, value } = followSourcePath(tokens, p, root, view.value(root), view.context);
    if (sources.some((s) => s.name === path)) continue;
    sources.push({
      name: path,
      value: runtimeDeepCopy(value),
      variableId: view.variableId(root),
      historyEnd: view.historyLength,
    });
  }

  return sources;
}

function followSourcePath(
  tokens: readonly Token[],
  start: number,
  root: string,
  rootValue: RuntimeValue,
  context: EvalContext,
): { path: string; value: RuntimeValue } {
  let path = root;
  let value = rootValue;
  for (const step of pathSteps(tokens, start).steps) {
    if (step.kind === 'index') {
      if (!step.closed || !step.tokens.every(isPureIndexToken)) break;
      try {
        const index = runtimeInteger(evaluateExpression(step.tokens, context));
        if (isArray(value)) {
          if (index < 0n || index >= BigInt(value.elements.length)) break;
          value = value.elements[Number(index)];
          path += `[${index}]`;
        } else if (index >= 0n && index < 3n && (isPoint(value) || isVector(value))) {
          const component = 'xyz'[Number(index)];
          value = index === 0n ? value.x : index === 1n ? value.y : value.z;
          path += '.' + component;
        } else break;
      } catch (e) {
        stdException(e);
        break;
      }
    } else if (step.kind === 'member' && (step.name === 'x' || step.name === 'y' || step.name === 'z')) {
      if (!isPoint(value) && !isVector(value)) break;
      value = step.name === 'x' ? value.x : step.name === 'y' ? value.y : value.z;
      path += '.' + step.name;
    } else break;
  }

  return { path, value };
}

export function captureArgumentTrace(
  expression: string,
  value: RuntimeValue,
  view: SourceView,
  depth = 0,
): RuntimeArgumentTrace {
  const trace: RuntimeArgumentTrace = { expression, sources: captureValueSources(expression, view), elements: [] };
  if (!isArray(value) || depth >= 4) return trace;
  const tokens = Lexer.scanExpression(expression);
  const initializer = isBraceList(tokens);
  const parts = initializer ? braceListItems(tokens) : [];
  for (let i = 0; i < value.elements.length; ++i) {
    let elementExpression = '';
    if (initializer) elementExpression = i < parts.length ? tokensToExpression(parts[i]) : '';
    else if (expression !== '') elementExpression = `${expression}[${i}]`;
    trace.elements.push(captureArgumentTrace(elementExpression, value.elements[i], view, depth + 1));
  }

  return trace;
}

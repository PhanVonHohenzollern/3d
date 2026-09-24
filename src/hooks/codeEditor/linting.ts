import { cppLanguage } from '@codemirror/lang-cpp';
import type { Diagnostic } from '@codemirror/lint';
import { StateEffect, StateField } from '@codemirror/state';
import type { RuntimeDiagnostic } from '../../core/runtime/RuntimeTypes';

export const setExecutionDiagnostics = StateEffect.define<readonly Diagnostic[]>();
export const executionDiagnosticsField = StateField.define<readonly Diagnostic[]>({
  create: () => [],
  update(value, transaction) {
    if (transaction.docChanged) return [];
    for (const effect of transaction.effects) if (effect.is(setExecutionDiagnostics)) return effect.value;

    return value;
  },
});

/** Map errors from an explicit preview run onto its source, without executing code for lint. */
export function executionDiagnostics(code: string, errors: readonly RuntimeDiagnostic[]): Diagnostic[] {
  const lines = code.split('\n');
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }

  return errors.map((error) => {
    const index = Math.min(Math.max(error.line - 1, 0), lines.length - 1);
    const line = lines[index];
    const token = /(?:unknown (?:variable|function)|undefined (?:variable|function)):\s*([A-Za-z_]\w*)/.exec(
      error.message,
    )?.[1];
    const tokenIndex = token ? line.search(new RegExp(`\\b${token}\\b`)) : -1;
    const start = tokenIndex >= 0 ? tokenIndex : line.search(/\S|$/);
    const from = offsets[index] + start;

    return {
      from,
      to: tokenIndex >= 0 ? from + token!.length : offsets[index] + line.length,
      severity: 'error',
      source: 'Preview runtime',
      message: error.message.replace(/^parser:\s*/, ''),
    };
  });
}

/** Syntax-only diagnostics. Never execute the document to produce lint feedback. */
export function lintCppSyntax(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  cppLanguage.parser.parse(code).iterate({
    enter(node) {
      if (!node.type.isError) return;
      const missing = node.from === node.to;
      const from = missing ? Math.max(0, node.from - 1) : node.from;
      const to = Math.max(from, node.to);
      const key = `${from}:${to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const token = code.slice(node.from, Math.min(node.to, node.from + 40));
      diagnostics.push({
        from,
        to,
        severity: 'error',
        source: 'C++ syntax',
        message: missing
          ? 'Missing expression, delimiter or semicolon.'
          : `Unexpected syntax: ${JSON.stringify(token)}`,
      });

      return false;
    },
  });

  return diagnostics;
}

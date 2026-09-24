import { cppLanguage } from '@codemirror/lang-cpp';
import type { Diagnostic } from '@codemirror/lint';

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
          ? 'Incomplete syntax near here. Check for a missing expression, delimiter, or semicolon.'
          : `Unexpected syntax: ${JSON.stringify(token)}.`,
      });

      return false;
    },
  });

  return diagnostics;
}

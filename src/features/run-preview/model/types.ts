import type { RuntimeDiagnostic } from '@engine/runtime';

export type PreviewMode = 'build' | 'debug';

export interface EditorExecutionFeedback {
  source: string;
  diagnostics: readonly RuntimeDiagnostic[];
  externalDiagnostics?: { name: string; line: number; sourceLine: number; message: string }[];
}

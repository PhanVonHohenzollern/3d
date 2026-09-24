import type { Ref } from 'react';
import type { RuntimeDiagnostic } from '../core/runtime/RuntimeTypes';

export interface EditorExecutionFeedback {
  source: string;
  diagnostics: readonly RuntimeDiagnostic[];
}

export interface CodeEditorHandle {
  toPlainText(): string;
  clear(): void;
  currentLine(): number;
  blockCount(): number;
  setTraceSourceLines(lines: ReadonlySet<number>, activeLine?: number): void;
  setTextCursorToLine(line: number): void;
  centerCursor(): void;
  cursorBlockText(): string;
  insertAtCursorBlockEnd(text: string): void;
  setFocus(): void;
}

export interface CodeEditorProps {
  executionFeedback?: EditorExecutionFeedback;
  previewStatus?: string;
  onTextChanged?: () => void;
  onCursorPositionChanged?: () => void;
  ref?: Ref<CodeEditorHandle>;
}

export interface TraceLines {
  lines: ReadonlySet<number>;
  activeLine: number;
}

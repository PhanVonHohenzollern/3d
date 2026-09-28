import type { Ref, ReactNode } from 'react';
import type { EditorExecutionFeedback } from '@/features/run-preview';

export type { EditorExecutionFeedback };

export interface CodeEditorHandle {
  toPlainText(): string;
  clear(): void;
  setSource(source: string): void;
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
  footer?: ReactNode;
  executionFeedback?: EditorExecutionFeedback;
  previewStatus?: string;
  onTextChanged?: () => void;
  onSourceActivated?: (line: number) => void;
  onCursorPositionChanged?: () => void;
  ref?: Ref<CodeEditorHandle>;
}

export interface TraceLines {
  lines: ReadonlySet<number>;
  activeLine: number;
}

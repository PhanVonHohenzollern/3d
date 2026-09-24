import type { Ref } from 'react';

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
  onTextChanged?: () => void;
  onCursorPositionChanged?: () => void;
  ref?: Ref<CodeEditorHandle>;
}

export interface TraceLines {
  lines: ReadonlySet<number>;
  activeLine: number;
}

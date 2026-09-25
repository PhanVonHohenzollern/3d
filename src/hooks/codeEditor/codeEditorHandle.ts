import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { CodeEditorHandle } from '../../types/editor';
import { setTraceLinesEffect, traceLinesField } from './traceLines';

export interface EditorSignals {
  onTextChanged?: () => void;
  onCursorPositionChanged?: () => void;
}

export function createCodeEditorHandle(
  view: () => EditorView,
  extensions: () => Extension[],
  signals: () => EditorSignals,
): CodeEditorHandle {
  return {
    toPlainText() {
      return view()
        .state.doc.toString()
        .replace(/\u00a0/g, ' ')
        .replace(/[\u2028\u2029]/g, '\n');
    },
    clear() {
      const v = view();
      const trace = v.state.field(traceLinesField);
      v.setState(EditorState.create({ doc: '', extensions: extensions() }));
      v.dispatch({ effects: setTraceLinesEffect.of(trace) });
      signals().onTextChanged?.();
      signals().onCursorPositionChanged?.();
    },
    setSource(source) {
      view().setState(EditorState.create({ doc: source, extensions: extensions() }));
      signals().onTextChanged?.();
      signals().onCursorPositionChanged?.();
    },
    currentLine() {
      const state = view().state;

      return state.doc.lineAt(state.selection.main.head).number;
    },
    blockCount() {
      return view().state.doc.lines;
    },
    setTraceSourceLines(lines, activeLine = -1) {
      view().dispatch({ effects: setTraceLinesEffect.of({ lines: new Set(lines), activeLine }) });
    },
    setTextCursorToLine(line) {
      const v = view();
      v.dispatch({ selection: EditorSelection.cursor(v.state.doc.line(line).from), scrollIntoView: true });
    },
    centerCursor() {
      const v = view();
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.selection.main.head, { y: 'center' }) });
    },
    cursorBlockText() {
      const state = view().state;

      return state.doc.lineAt(state.selection.main.head).text;
    },
    insertAtCursorBlockEnd(text) {
      const v = view();
      const end = v.state.doc.lineAt(v.state.selection.main.head).to;
      v.dispatch({
        changes: { from: end, insert: text },
        selection: EditorSelection.cursor(end + text.length),
        scrollIntoView: true,
        userEvent: 'input',
      });
    },
    setFocus() {
      view().focus();
    },
  };
}

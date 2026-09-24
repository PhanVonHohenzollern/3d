// Port of editor/CodeEditor.{h,cpp}: a QPlainTextEdit with a line-number
// area, current-line highlight and API Trace source-line highlighting
// (setTraceSourceLines), built on CodeMirror 6.
//
// The imperative handle mirrors the QPlainTextEdit/CodeEditor calls made by
// MainWindow. onTextChanged / onCursorPositionChanged are the
// QPlainTextEdit::textChanged / cursorPositionChanged signals and are emitted
// synchronously from the dispatching call, like Qt signals.

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { history, historyKeymap, insertNewline, standardKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorSelection, EditorState, RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  drawSelection,
  EditorView,
  GutterMarker,
  gutterLineClass,
  highlightActiveLine,
  keymap,
  lineNumbers,
  type Command,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import './CodeEditor.css';

export interface CodeEditorHandle {
  /** QPlainTextEdit::toPlainText() */
  toPlainText(): string;
  /** QPlainTextEdit::clear(): also clears undo history; emits textChanged and cursorPositionChanged. */
  clear(): void;
  /** 1-based line (block number + 1) of the text cursor. */
  currentLine(): number;
  /** QTextDocument::blockCount() */
  blockCount(): number;
  setTraceSourceLines(lines: ReadonlySet<number>, activeLine?: number): void;
  /** setTextCursor(QTextCursor(findBlockByNumber(line - 1))): cursor at the start of `line`, no selection. */
  setTextCursorToLine(line: number): void;
  /** QPlainTextEdit::centerCursor() */
  centerCursor(): void;
  /** textCursor().block().text() */
  cursorBlockText(): string;
  /**
   * One edit block: textCursor().movePosition(EndOfBlock), insertText(text),
   * then setTextCursor(cursor) so the cursor follows the inserted text.
   */
  insertAtCursorBlockEnd(text: string): void;
  /** QWidget::setFocus() */
  setFocus(): void;
}

export interface CodeEditorProps {
  onTextChanged?: () => void;
  onCursorPositionChanged?: () => void;
  ref?: Ref<CodeEditorHandle>;
}

// ---------------------------------------------------------------------------
// Trace source lines (CodeEditor::m_traceLines / m_activeTraceLine)

interface TraceLines {
  lines: ReadonlySet<number>;
  activeLine: number;
}

const setTraceLinesEffect = StateEffect.define<TraceLines>();

class TracedLineNumberMarker extends GutterMarker {
  override elementClass = 'cm-tracedLineNumber';
}
const tracedLineNumberMarker = new TracedLineNumberMarker();

const traceLineDecoration = Decoration.line({ class: 'cm-traceLine' });
const activeTraceLineDecoration = Decoration.line({ class: 'cm-traceLine cm-traceLine-active' });

function validTraceLines(state: EditorState, trace: TraceLines): number[] {
  return [...trace.lines].filter((line) => line >= 1 && line <= state.doc.lines).sort((a, b) => a - b);
}

const traceLinesField = StateField.define<TraceLines>({
  create: () => ({ lines: new Set(), activeLine: -1 }),
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setTraceLinesEffect)) value = effect.value;
    return value;
  },
  provide: (field) => [
    // CodeEditor::highlightCurrentLine(): full-width background plus bold
    // foreground on every traced block; the active trace line is amber.
    EditorView.decorations.compute([field, 'doc'], (state): DecorationSet => {
      const trace = state.field(field);
      return Decoration.set(
        validTraceLines(state, trace).map((line) =>
          (line === trace.activeLine ? activeTraceLineDecoration : traceLineDecoration).range(
            state.doc.line(line).from,
          ),
        ),
      );
    }),
    // CodeEditor::lineNumberAreaPaintEvent(): traced numbers are bold on amber.
    gutterLineClass.compute([field, 'doc'], (state) => {
      const trace = state.field(field);
      return RangeSet.of(
        validTraceLines(state, trace).map((line) => tracedLineNumberMarker.range(state.doc.line(line).from)),
      );
    }),
  ],
});

// ---------------------------------------------------------------------------
// Editor setup: QPlainTextEdit behavior (no auto-indent, Tab inserts a tab,
// no wrapping), 11 pt system fixed font, tab stop = 4 spaces.

/** QPlainTextEdit inserts a literal tab, replacing the selection. */
const insertTabCharacter: Command = (view) => {
  view.dispatch(view.state.replaceSelection('\t'), { scrollIntoView: true, userEvent: 'input' });
  return true;
};

const syntaxColors = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.definitionKeyword, tags.modifier, tags.operatorKeyword, tags.self, tags.null, tags.bool],
    color: '#569cd6',
  },
  { tag: tags.controlKeyword, color: '#c586c0' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.namespace], color: '#4ec9b0' },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.function(tags.definition(tags.variableName)),
    ],
    color: '#dcdcaa',
  },
  { tag: [tags.number, tags.literal], color: '#b5cea8' },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: '#ce9178' },
  { tag: tags.escape, color: '#d7ba7d' },
  { tag: [tags.lineComment, tags.blockComment, tags.comment], color: '#6a9955' },
  { tag: [tags.processingInstruction, tags.meta], color: '#c586c0' },
  { tag: tags.special(tags.name), color: '#4fc1ff' },
]);

// Colors from CodeEditor.cpp. Line backgrounds are translucent so that the
// selection layer beneath them stays visible, as Qt draws extra selections
// below the text selection; over the #1e1e1e base they blend to exactly
// QColor(45,45,48) current line, (54,64,83) trace line, (92,66,20) active trace.
const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: '#1e1e1e', color: '#d4d4d4', fontSize: 'var(--font-size-code)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.25' },
    '.cm-content': { padding: '4px 0', caretColor: '#aeafad' },
    '.cm-line': { padding: '0 4px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#aeafad' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#264f78',
    },
    '.cm-content ::selection': { backgroundColor: '#264f78' },
    // LineNumberArea: QColor(37,37,38) background, QColor(150,150,150) numbers,
    // width 12 + digits * digitWidth, right-aligned 6 px from the edge.
    '.cm-gutters': { backgroundColor: '#252526', color: '#969696', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px', minWidth: '0' },
    '.cm-gutterElement.cm-tracedLineNumber': { backgroundColor: '#554117', color: '#ffde82', fontWeight: 'bold' },
    '.cm-activeLine': { backgroundColor: 'rgba(60, 60, 66, 0.5)' },
    '.cm-line.cm-traceLine': { backgroundColor: 'rgba(60, 73, 96, 0.8)' },
    '.cm-line.cm-traceLine-active': { backgroundColor: 'rgba(108, 75, 18, 0.8)' },
    '.cm-line.cm-traceLine, .cm-line.cm-traceLine *': { color: '#ffe39d', fontWeight: 'bold' },
  },
  { dark: true },
);

function editorExtensions(onUpdate: (update: ViewUpdate) => void): Extension[] {
  return [
    editorTheme,
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    EditorState.tabSize.of(4),
    keymap.of([
      { key: 'Enter', run: insertNewline, shift: insertNewline },
      { key: 'Tab', run: insertTabCharacter, preventDefault: true },
      ...standardKeymap,
      ...historyKeymap,
    ]),
    cpp(),
    syntaxHighlighting(syntaxColors),
    traceLinesField,
    EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    EditorView.updateListener.of(onUpdate),
  ];
}

// ---------------------------------------------------------------------------

export function CodeEditor({ onTextChanged, onCursorPositionChanged, ref }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const extensionsRef = useRef<Extension[]>([]);
  const signals = useRef({ onTextChanged, onCursorPositionChanged });
  signals.current = { onTextChanged, onCursorPositionChanged };

  useEffect(() => {
    const extensions = editorExtensions((update) => {
      // Qt emits cursorPositionChanged only when the position actually moves.
      const moved = update.startState.selection.main.head !== update.state.selection.main.head;
      if (update.docChanged) signals.current.onTextChanged?.();
      if (moved) signals.current.onCursorPositionChanged?.();
    });
    const view = new EditorView({ parent: hostRef.current!, state: EditorState.create({ doc: '', extensions }) });
    viewRef.current = view;
    extensionsRef.current = extensions;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, (): CodeEditorHandle => {
    const view = () => viewRef.current!;
    return {
      toPlainText() {
        // QTextDocument::toPlainText() converts nbsp and Unicode line/paragraph separators.
        return view()
          .state.doc.toString()
          .replace(/\u00a0/g, ' ')
          .replace(/[\u2028\u2029]/g, '\n');
      },
      clear() {
        const v = view();
        // m_traceLines survive clear(); only line numbers that still exist are painted.
        const trace = v.state.field(traceLinesField);
        v.setState(EditorState.create({ doc: '', extensions: extensionsRef.current }));
        v.dispatch({ effects: setTraceLinesEffect.of(trace) });
        signals.current.onTextChanged?.();
        signals.current.onCursorPositionChanged?.();
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
        const position = v.state.doc.line(line).from;
        // QPlainTextEdit::setTextCursor() also ensures the cursor is visible.
        v.dispatch({ selection: EditorSelection.cursor(position), scrollIntoView: true });
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
  }, []);

  return <div ref={hostRef} className="code-editor" />;
}

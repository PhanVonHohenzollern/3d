import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forEachDiagnostic, openLintPanel } from '@codemirror/lint';
import type { CodeEditorProps } from '../types/editor';
import { createCodeEditorHandle, type EditorSignals } from './codeEditor/codeEditorHandle';
import { createEditorExtensions } from './codeEditor/editorExtensions';
import { executionDiagnostics, setExecutionDiagnostics } from './codeEditor/linting';

interface EditorProblem {
  from: number;
  to: number;
  line: number;
  column: number;
  message: string;
}

export function useCodeEditor({ onTextChanged, onCursorPositionChanged, executionFeedback, ref }: CodeEditorProps) {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [problems, setProblems] = useState<EditorProblem[]>([]);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const extensionsRef = useRef<Extension[]>([]);
  const signalsRef = useRef<EditorSignals>({});

  useLayoutEffect(() => {
    signalsRef.current = { onTextChanged, onCursorPositionChanged };
  }, [onTextChanged, onCursorPositionChanged]);

  useEffect(() => {
    const extensions = createEditorExtensions((update) => {
      const next: EditorProblem[] = [];
      if (!update.docChanged)
        forEachDiagnostic(update.state, (diagnostic, from, to) => {
          const line = update.state.doc.lineAt(from);
          next.push({ from, to, line: line.number, column: from - line.from + 1, message: diagnostic.message });
        });
      setProblems((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
      if (update.docChanged || update.selectionSet) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        const column = head - line.from + 1;
        setCursorPosition((previous) =>
          previous.line === line.number && previous.column === column ? previous : { line: line.number, column },
        );
      }
      const moved = update.startState.selection.main.head !== update.state.selection.main.head;
      if (update.docChanged) signalsRef.current.onTextChanged?.();
      if (moved) signalsRef.current.onCursorPositionChanged?.();
    });
    const view = new EditorView({ parent: hostRef.current!, state: EditorState.create({ doc: '', extensions }) });
    viewRef.current = view;
    extensionsRef.current = extensions;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !executionFeedback) return;
    const code = view.state.doc.toString();
    const source = code.replace(/\u00a0/g, ' ').replace(/[\u2028\u2029]/g, '\n');
    const diagnostics =
      source === executionFeedback.source ? executionDiagnostics(source, executionFeedback.diagnostics) : [];
    view.dispatch({ effects: setExecutionDiagnostics.of(diagnostics) });
  }, [executionFeedback]);

  useImperativeHandle(
    ref,
    () =>
      createCodeEditorHandle(
        () => viewRef.current!,
        () => extensionsRef.current,
        () => signalsRef.current,
      ),
    [],
  );

  return {
    hostRef,
    cursorPosition,
    problems,
    showProblem: (problem: EditorProblem) => {
      const view = viewRef.current;
      if (!view || problem.to > view.state.doc.length) return;
      view.dispatch({ selection: { anchor: problem.from, head: problem.to }, scrollIntoView: true });
      view.focus();
    },
    showAllProblems: () => {
      if (viewRef.current) openLintPanel(viewRef.current);
    },
  };
}

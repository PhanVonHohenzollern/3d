import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { CodeEditorProps } from '../types/editor';
import { createCodeEditorHandle, type EditorSignals } from './codeEditor/codeEditorHandle';
import { createEditorExtensions } from './codeEditor/editorExtensions';

export function useCodeEditor({ onTextChanged, onCursorPositionChanged, ref }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const extensionsRef = useRef<Extension[]>([]);
  const signalsRef = useRef<EditorSignals>({});

  useLayoutEffect(() => {
    signalsRef.current = { onTextChanged, onCursorPositionChanged };
  }, [onTextChanged, onCursorPositionChanged]);

  useEffect(() => {
    const extensions = createEditorExtensions((update) => {
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

  return hostRef;
}

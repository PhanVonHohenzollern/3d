import { useCodeEditor } from '../hooks/useCodeEditor';
import type { CodeEditorProps } from '../types/editor';

export function CodeEditor(props: CodeEditorProps) {
  const hostRef = useCodeEditor(props);

  return <div ref={hostRef} className="h-full w-full overflow-hidden bg-editor font-code text-code select-text" />;
}

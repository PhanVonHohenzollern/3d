import { useCodeEditor } from '../hooks/useCodeEditor';
import type { CodeEditorProps } from '../types/editor';
import { isMacPlatform } from '../utils/platform';

export function CodeEditor(props: CodeEditorProps) {
  const { hostRef, cursorPosition } = useCodeEditor(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={hostRef}
        className="workspace-surface min-h-0 w-full flex-1 overflow-hidden bg-editor font-code text-code select-text"
      />
      <div className="flex h-[30px] shrink-0 items-center gap-1.5 pr-1 pl-2.5 text-[11px] whitespace-nowrap text-muted-foreground">
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-ui text-[10px]">
          {isMacPlatform ? '⌘⇧' : 'Ctrl'}
        </kbd>
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-ui text-[10px]">Space</kbd>
        <span>Suggestions</span>
        <span className="ml-auto font-code tabular-nums">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
      </div>
    </div>
  );
}

import { useCodeEditor } from '../hooks/useCodeEditor';
import type { CodeEditorProps } from '../types/editor';
import { isMacPlatform } from '../utils/platform';
import { Button } from './ui/button';

export function CodeEditor(props: CodeEditorProps) {
  const { hostRef, problemCount, showProblems } = useCodeEditor(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={hostRef}
        className="workspace-surface min-h-0 w-full flex-1 overflow-hidden bg-editor font-code text-code select-text"
      />
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-line/60 px-3 text-[11px] text-muted-foreground">
        <Button
          variant="ghost"
          size="xs"
          className="h-6 px-1 text-[11px]"
          onClick={showProblems}
          title={`C++ syntax diagnostics (${isMacPlatform ? '⌘⇧M' : 'Ctrl+Shift+M'}). F8 jumps to the next problem.`}
        >
          Problems{problemCount > 0 ? ` (${problemCount})` : ''}
        </Button>
        <div className="flex items-center gap-2">
          <span>Suggestions</span>
          <kbd className="rounded bg-secondary px-1.5 py-0.5 font-ui text-[10px]">
            {isMacPlatform ? '⌘⇧Space' : 'Ctrl Space'}
          </kbd>
        </div>
      </div>
    </div>
  );
}

import { useCodeEditor } from '../hooks/useCodeEditor';
import type { CodeEditorProps } from '../types/editor';
import { isMacPlatform } from '../utils/platform';

export function CodeEditor(props: CodeEditorProps) {
  const { hostRef, cursorPosition, problems, showProblem, showAllProblems } = useCodeEditor(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={hostRef}
        className="workspace-surface min-h-0 w-full flex-1 overflow-hidden bg-editor font-code text-code select-text"
      />
      {props.executionFeedback?.externalDiagnostics?.map((problem, index) => (
        <button
          key={index}
          type="button"
          className="shrink-0 truncate border-t border-line px-2 py-1 text-left text-[11px] text-error hover:underline"
          onClick={() => props.onSourceActivated?.(problem.sourceLine)}
        >
          {problem.name} · L{problem.line} · {problem.message}
        </button>
      ))}
      {problems.length > 0 && (
        <div aria-label="C++ errors" className="shrink-0 border-t border-line px-2 py-1 text-[11px] text-error">
          {problems.slice(0, 3).map((problem, index) => (
            <button
              key={index}
              type="button"
              title={problem.message}
              className="block w-full truncate py-0.5 text-left hover:underline"
              onClick={() => showProblem(problem)}
            >
              L{problem.line}:{problem.column} · {problem.message}
            </button>
          ))}
          {problems.length > 3 && (
            <button type="button" className="underline" onClick={showAllProblems}>
              View all {problems.length} errors
            </button>
          )}
        </div>
      )}
      {props.previewStatus && (
        <div role="status" className="shrink-0 border-t border-line px-2.5 py-1 text-[11px] text-muted-foreground">
          {props.previewStatus}
        </div>
      )}
      <div className="flex min-h-[30px] shrink-0 flex-wrap items-center gap-1.5 py-1 pr-1 pl-2.5 text-[11px] whitespace-nowrap text-muted-foreground">
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-ui text-[10px]">
          {isMacPlatform ? '⌘⇧' : 'Ctrl'}
        </kbd>
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-ui text-[10px]">Space</kbd>
        <span>Suggestions</span>
        <span className="ml-auto font-code tabular-nums">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        {props.footer}
      </div>
    </div>
  );
}

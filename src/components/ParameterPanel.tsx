import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useParameterPanel } from '../hooks/useParameterPanel';
import type { ParameterPanelProps } from '../types/panels';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { preventDefault } from '../utils/events';

export function ParameterPanel(props: ParameterPanelProps) {
  const { fields, resetToSource } = useParameterPanel(props);

  return (
    <div className="@container/parameters flex h-full min-h-0 flex-col bg-window">
      <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-line pr-2 pl-4">
        <h3 className="text-xs font-semibold">get_val parameters</h3>
        <span className="rounded-full bg-secondary px-1.5 font-code text-[10px] tabular-nums">{fields.length}</span>
        <span className="ml-auto hidden text-[11px] text-muted-foreground @min-[650px]/parameters:inline">
          Enter to apply · Esc to revert
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1.5 px-2 text-[11px] @min-[650px]/parameters:ml-0"
          disabled={fields.length === 0}
          onClick={resetToSource}
        >
          <RotateCcw className="size-3" aria-hidden />
          Reset to source
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs">
          <p className="font-medium">No editable parameters</p>
          <p className="text-muted-foreground">Add a get_val() call in your code to expose an editable parameter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 content-start gap-4 overflow-auto p-4 @min-[340px]/parameters:grid-cols-2 @min-[800px]/parameters:grid-cols-4">
          {fields.map((field) => (
            <label key={field.key} className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center justify-between gap-2 text-xs font-medium">
                <span className="truncate">{field.label}</span>
                <span className="font-code text-[10px] font-normal text-muted-foreground">{field.line}</span>
              </span>
              <span className="flex overflow-hidden rounded-md border border-input bg-base focus-within:ring-2 focus-within:ring-ring">
                <Input
                  aria-label={field.label}
                  className="h-8 rounded-none border-0 px-2 font-code text-xs shadow-none focus-visible:ring-0 md:text-xs"
                  value={field.value}
                  spellCheck={false}
                  onFocus={field.beginEdit}
                  onChange={(event) => field.change(event.target.value)}
                  onBlur={field.commit}
                  onKeyDown={field.onKeyDown}
                />
                {field.numeric && (
                  <>
                    <Button
                      aria-label={`Decrease ${field.label}`}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-7 shrink-0 rounded-none border-l border-line text-muted-foreground"
                      disabled={field.stepDisabled}
                      onMouseDown={preventDefault}
                      onClick={field.decrement}
                    >
                      <Minus className="size-3" aria-hidden />
                    </Button>
                    <Button
                      aria-label={`Increase ${field.label}`}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-7 shrink-0 rounded-none border-l border-line text-muted-foreground"
                      disabled={field.stepDisabled}
                      onMouseDown={preventDefault}
                      onClick={field.increment}
                    >
                      <Plus className="size-3" aria-hidden />
                    </Button>
                  </>
                )}
              </span>
              <span className="truncate font-code text-[10px] text-muted-foreground">{field.description}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

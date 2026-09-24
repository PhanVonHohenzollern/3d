import { useAction } from '../hooks/useAction';
import type { Action } from '../hooks/mainWindow/Action';
import type { ActionListItem } from '../types/mainWindow';
import { cn } from '../utils/cn';
import { preventDefault } from '../utils/events';

function ToolBarButton({ action }: { action: Action }) {
  const { iconText, checkable, checked, trigger } = useAction(action);

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={checkable ? checked : undefined}
      className={cn(
        'h-6 rounded-qt border px-[7px] whitespace-nowrap text-fg',
        checked
          ? 'border-line-strong bg-tool-checked shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]'
          : 'border-transparent bg-transparent hover:border-line-strong hover:bg-linear-to-b/srgb hover:from-button-top hover:to-button-bottom active:bg-button-pressed active:bg-none',
      )}
      onMouseDown={preventDefault}
      onClick={trigger}
    >
      {iconText}
    </button>
  );
}

export function ToolBar({ items }: { items: readonly ActionListItem[] }) {
  return (
    <div
      role="toolbar"
      className="flex min-h-[30px] flex-none flex-wrap items-center gap-0.5 border-b border-line bg-linear-to-b/srgb from-bar-top to-bar-bottom px-1 py-0.5"
    >
      <span className="mr-1 h-[18px] w-1.5 bg-[radial-gradient(#9a9a9a_1px,transparent_1.2px)] bg-size-[3px_3px]" />
      {items.map((item, i) =>
        item === 'separator' ? (
          <span key={`separator-${i}`} className="mx-1 h-[18px] w-px bg-line-strong" />
        ) : (
          <ToolBarButton key={item.text} action={item} />
        ),
      )}
    </div>
  );
}

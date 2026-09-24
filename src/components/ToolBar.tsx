import { Box, CircleDot, Eye, EyeOff, Maximize, MoveUpRight, Scan, Tags, type LucideIcon } from 'lucide-react';
import { useAction } from '../hooks/useAction';
import type { Action } from '../hooks/mainWindow/Action';
import type { ActionListItem } from '../types/mainWindow';
import { cn } from '../utils/cn';
import { preventDefault } from '../utils/events';

const presentation: Record<string, { label: string; icon: LucideIcon }> = {
  'Show Geometry': { label: 'Geometry', icon: Box },
  'Geometry Wireframe': { label: 'Wireframe', icon: Scan },
  'Fit Scene': { label: 'Fit scene', icon: Maximize },
  'Show Points': { label: 'Points', icon: CircleDot },
  'Show Vectors': { label: 'Vectors', icon: MoveUpRight },
  'Show Labels': { label: 'Labels', icon: Tags },
  'Hide Selected': { label: 'Hide selected', icon: EyeOff },
  'Show Selected': { label: 'Show selected', icon: Eye },
};

function ToolBarButton({ action }: { action: Action }) {
  const { iconText, checkable, checked, trigger } = useAction(action);
  const item = presentation[iconText];
  const Icon = item?.icon;

  return (
    <button
      type="button"
      aria-label={iconText}
      title={iconText}
      aria-pressed={checkable ? checked : undefined}
      className={cn(
        'flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
        checked
          ? 'border-line bg-base text-fg shadow-xs'
          : 'border-transparent text-muted hover:bg-secondary hover:text-fg',
      )}
      onMouseDown={preventDefault}
      onClick={trigger}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {item?.label ?? iconText}
    </button>
  );
}

export function ToolBar({ items }: { items: readonly ActionListItem[] }) {
  return (
    <div
      role="toolbar"
      aria-label="Preview display"
      className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto px-4 sm:px-6"
    >
      <span className="mr-2 hidden text-[10px] font-medium tracking-widest text-muted lg:inline">DISPLAY</span>
      {items.map((item, i) =>
        item === 'separator' ? (
          <span key={`separator-${i}`} role="separator" className="mx-2 h-4 w-px shrink-0 bg-line" />
        ) : (
          <ToolBarButton key={item.text} action={item} />
        ),
      )}
    </div>
  );
}

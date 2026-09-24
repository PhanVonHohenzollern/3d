import { Button } from './ui/button';
import { Separator } from './ui/separator';
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
    <Button
      type="button"
      variant={checked ? 'outline' : 'ghost'}
      size="sm"
      aria-label={iconText}
      title={iconText}
      aria-pressed={checkable ? checked : undefined}
      className={cn('shrink-0 text-xs', !checked && 'text-muted-foreground')}
      onMouseDown={preventDefault}
      onClick={trigger}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {item?.label ?? iconText}
    </Button>
  );
}

export function ToolBar({ items }: { items: readonly ActionListItem[] }) {
  return (
    <div
      role="toolbar"
      aria-label="Preview display"
      className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto px-4 sm:px-6"
    >
      <span className="mr-2 hidden text-[10px] font-medium tracking-widest text-muted-foreground lg:inline">
        DISPLAY
      </span>
      {items.map((item, i) =>
        item === 'separator' ? (
          <Separator key={`separator-${i}`} orientation="vertical" className="mx-2 h-4!" />
        ) : (
          <ToolBarButton key={item.text} action={item} />
        ),
      )}
    </div>
  );
}

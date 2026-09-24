import { Box, CircleDot, Eye, EyeOff, Maximize, MoveUpRight, Scan, Tags, type LucideIcon } from 'lucide-react';
import { useAction } from '../hooks/useAction';
import type { Action } from '../hooks/mainWindow/Action';
import type { ActionListItem } from '../types/mainWindow';
import { cn } from '../lib/utils';
import { preventDefault } from '../utils/events';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const presentation: Record<string, { label: string; icon: LucideIcon; description: string }> = {
  'Show Geometry': { label: 'Geometry', icon: Box, description: 'Show or hide generated geometry.' },
  'Geometry Wireframe': { label: 'Wireframe', icon: Scan, description: 'Display geometry as wireframe.' },
  'Fit Scene': { label: 'Fit scene', icon: Maximize, description: 'Fit the camera to the scene.' },
  'Show Points': { label: 'Points', icon: CircleDot, description: 'Show or hide point debug markers.' },
  'Show Vectors': { label: 'Vectors', icon: MoveUpRight, description: 'Show or hide vector debug arrows.' },
  'Show Labels': { label: 'Labels', icon: Tags, description: 'Show or hide debug labels.' },
  'Hide Selected': {
    label: 'Hide selected',
    icon: EyeOff,
    description: 'Hide selected point and vector debug overlays.',
  },
  'Show Selected': {
    label: 'Show selected',
    icon: Eye,
    description:
      'Restore selected point and vector debug overlays. The Points, Vectors, and Labels toggles still apply.',
  },
};

const groupNames = ['Scene', 'Debug overlays', 'Selection visibility'];

function ToolBarButton({ action }: { action: Action }) {
  const { iconText, checkable, checked, shortcutText, trigger } = useAction(action);
  const item = presentation[iconText];
  const Icon = item?.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={iconText}
          aria-pressed={checkable ? checked : undefined}
          className={cn(
            'h-8 shrink-0 gap-2 px-3 text-xs focus-visible:ring-2',
            checked
              ? 'bg-base text-fg shadow-xs ring-1 ring-line hover:bg-base'
              : 'text-muted-foreground hover:bg-base/60 hover:text-fg',
          )}
          onMouseDown={preventDefault}
          onClick={trigger}
        >
          {Icon && <Icon className="size-3.5" aria-hidden />}
          {item?.label ?? iconText}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="max-w-64">
        <p>{item?.description ?? iconText}</p>
        {(checkable || shortcutText) && (
          <div className="mt-1 flex items-center justify-between gap-4 text-[10px] opacity-75">
            {checkable && <span>{checked ? 'On' : 'Off'}</span>}
            {shortcutText && <kbd className="font-code">{shortcutText}</kbd>}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function ToolBar({ items }: { items: readonly ActionListItem[] }) {
  const groups: Action[][] = [[]];
  for (const item of items) {
    if (item === 'separator') groups.push([]);
    else groups[groups.length - 1].push(item);
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label="Preview display"
        className="flex shrink-0 items-end gap-4 overflow-x-auto px-2 pt-1 pb-3 sm:px-5"
      >
        {groups.map((actions, index) => (
          <div key={index} role="group" aria-label={groupNames[index]} className="flex shrink-0 flex-col gap-1.5">
            <span className="px-1 text-[11px] font-medium text-muted-foreground">{groupNames[index]}</span>
            <div className="flex items-center gap-1 rounded-lg bg-secondary/70 p-1">
              {actions.map((action) => (
                <ToolBarButton key={action.text} action={action} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

import { Box, CircleDot, Eye, EyeOff, Maximize, MoveUpRight, Scan, Tags, type LucideIcon } from 'lucide-react';
import { useAction } from '@/shared/lib/action';
import type { Action } from '@/shared/lib/action';
import type { ToolBarProps, ToolBarButtonProps } from '@/widgets/workspace-header/ui/types';
import { cn } from '@/shared/lib/cn';
import { preventDefault } from '@/shared/lib/events';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

const presentation: Record<string, { label: string; icon: LucideIcon; description: string }> = {
  'Show Geometry': { label: 'Geometry', icon: Box, description: 'Show or hide geometry' },
  'Geometry Wireframe': { label: 'Wireframe', icon: Scan, description: 'Draw geometry as wireframe' },
  'Fit Scene': { label: 'Fit', icon: Maximize, description: 'Fit camera to scene' },
  'Show Points': { label: 'Points', icon: CircleDot, description: 'Show or hide point markers' },
  'Show Vectors': { label: 'Vectors', icon: MoveUpRight, description: 'Show or hide vector arrows' },
  'Show Labels': { label: 'Labels', icon: Tags, description: 'Show or hide labels' },
  'Hide Selected': { label: 'Hide', icon: EyeOff, description: 'Hide selected points and vectors' },
  'Show Selected': { label: 'Show', icon: Eye, description: 'Unhide selected points and vectors' },
};

const groupNames = ['Scene', 'Debug overlays', 'Selection visibility'];

function ToolBarButton({ action }: ToolBarButtonProps) {
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
            'h-7 shrink-0 gap-1.5 px-2 text-xs focus-visible:ring-2',
            checked
              ? 'bg-base text-fg shadow-xs ring-1 ring-line hover:bg-base'
              : 'text-muted-foreground hover:bg-base/60 hover:text-fg',
          )}
          onMouseDown={preventDefault}
          onClick={trigger}
        >
          {Icon && <Icon className="size-3.5" aria-hidden />}
          <span className="hidden @min-[900px]/preview:inline">{item?.label ?? iconText}</span>
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

export function ToolBar({ items }: ToolBarProps) {
  const groups: Action[][] = [[]];
  for (const item of items) {
    if (item === 'separator') groups.push([]);
    else groups[groups.length - 1].push(item);
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div role="toolbar" aria-label="Preview display" className="flex min-w-0 items-center gap-2 overflow-x-auto py-1">
        {groups.map((actions, index) => (
          <div
            key={index}
            role="group"
            aria-label={groupNames[index]}
            className="flex shrink-0 items-center border-l border-line pl-2 first:border-0 first:pl-0"
          >
            <div className="flex items-center gap-1">
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

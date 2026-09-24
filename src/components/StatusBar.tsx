import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useStatusBar } from '../hooks/useStatusBar';
import type { StatusBarProps } from '../types/statusBar';
import { cn } from '../utils/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const presentation = {
  info: { icon: CircleCheck, label: 'Status', style: 'text-muted-foreground' },
  warning: { icon: TriangleAlert, label: 'Warning', style: 'border-warning/30 bg-warning/5 text-warning' },
  error: { icon: CircleAlert, label: 'Error', style: 'border-destructive/30 bg-destructive/5 text-destructive' },
};

export function StatusBar({ model }: StatusBarProps) {
  const { message, tone } = useStatusBar(model);
  const { icon: Icon, label, style } = presentation[tone];

  return (
    <footer className={cn('flex h-8 shrink-0 items-center gap-2 border-t border-line px-3 text-[11px]', style)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              tabIndex={0}
              className="min-w-0 flex-1 truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="sr-only">{label}: </span>
              {message}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="start"
            sideOffset={8}
            className="max-w-[min(560px,calc(100vw-24px))] text-left leading-relaxed wrap-anywhere whitespace-pre-wrap"
          >
            {message}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="hidden shrink-0 text-muted-foreground sm:inline">Local</span>
    </footer>
  );
}

import type { ResizeHandleProps } from '../types/layout';
import { cn } from '../utils/cn';

export function ResizeHandle({ orientation, label, value, min, max, onPointerDown, onKeyDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      title={`${label}. Drag or use arrow keys; hold Shift for larger steps.`}
      className={cn(
        'group flex shrink-0 touch-none items-center justify-center rounded-sm transition-colors outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        orientation === 'vertical' ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize',
      )}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span
        className={cn(
          'rounded-full bg-line-strong transition-colors group-hover:bg-foreground/60 group-focus-visible:bg-foreground/60',
          orientation === 'vertical' ? 'h-8 w-0.5' : 'h-0.5 w-8',
        )}
      />
    </div>
  );
}

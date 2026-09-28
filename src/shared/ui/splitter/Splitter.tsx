import { useSplitter } from '@/shared/ui/splitter/useSplitter';
import type { SplitterProps } from '@/shared/ui/splitter/types';
import { cn } from '@/shared/lib/cn';
import { ResizeHandle } from '@/shared/ui/splitter/ResizeHandle';

export function Splitter({ className, children, label, ...options }: SplitterProps) {
  const { containerRef, paneStyles, horizontal, onHandlePointerDown, onHandleKeyDown, value, min, max } =
    useSplitter(options);

  return (
    <div ref={containerRef} className={cn('flex h-full w-full overflow-hidden', !horizontal && 'flex-col', className)}>
      <div className="min-h-0 min-w-0 flex-none overflow-hidden" style={paneStyles[0]}>
        {children[0]}
      </div>
      <ResizeHandle
        orientation={horizontal ? 'vertical' : 'horizontal'}
        label={label}
        value={value}
        min={min}
        max={max}
        onPointerDown={onHandlePointerDown}
        onKeyDown={onHandleKeyDown}
      />
      <div className="min-h-0 min-w-0 flex-none overflow-hidden" style={paneStyles[1]}>
        {children[1]}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { useSplitter, type SplitterOptions } from '../hooks/useSplitter';
import { cn } from '../utils/cn';

interface SplitterProps extends SplitterOptions {
  className?: string;
  children: [ReactNode, ReactNode];
}

export function Splitter({ className, children, ...options }: SplitterProps) {
  const { containerRef, paneStyles, horizontal, onHandlePointerDown } = useSplitter(options);

  return (
    <div ref={containerRef} className={cn('flex h-full w-full overflow-hidden', !horizontal && 'flex-col', className)}>
      <div className="min-h-0 min-w-0 flex-none overflow-hidden" style={paneStyles[0]}>
        {children[0]}
      </div>
      <div
        className={cn(
          'flex-none touch-none bg-window hover:bg-handle-hover',
          horizontal ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize',
        )}
        onPointerDown={onHandlePointerDown}
      />
      <div className="min-h-0 min-w-0 flex-none overflow-hidden" style={paneStyles[1]}>
        {children[1]}
      </div>
    </div>
  );
}

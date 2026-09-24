import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function ComboBox({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    // disabled:opacity-70 restores Chrome's UA select:disabled style that Tailwind preflight resets.
    <select
      className={cn(
        'h-8 rounded-md border border-line bg-base px-2 text-xs text-fg shadow-xs focus:border-line-hover focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

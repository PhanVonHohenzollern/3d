import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function ComboBox({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    // disabled:opacity-70 restores Chrome's UA select:disabled style that Tailwind preflight resets.
    <select
      className={cn(
        'h-6 rounded-qt border border-line-strong bg-linear-to-b/srgb from-button-top to-button-bottom px-1 text-fg focus:border-highlight focus:outline-none disabled:border-line disabled:text-disabled disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

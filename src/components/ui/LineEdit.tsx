import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '../../utils/cn';

interface LineEditProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function LineEdit({ className, spellCheck = false, ...props }: LineEditProps) {
  return (
    <input
      spellCheck={spellCheck}
      className={cn(
        'h-8 min-w-0 rounded-md border border-line bg-base px-2.5 py-1 text-xs text-fg shadow-xs transition-colors placeholder:text-muted focus:border-line-hover focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

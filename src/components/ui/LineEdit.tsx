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
        'h-6 min-w-0 rounded-[2px] border border-line-strong bg-base px-[5px] py-px text-fg placeholder:text-disabled focus:border-highlight focus:outline-none disabled:border-line disabled:bg-window disabled:text-disabled',
        className,
      )}
      {...props}
    />
  );
}

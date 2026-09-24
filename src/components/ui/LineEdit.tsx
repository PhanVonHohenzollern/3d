import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

interface LineEditProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function LineEdit({ className, spellCheck = false, ...props }: LineEditProps) {
  return <Input spellCheck={spellCheck} className={cn('h-8 text-xs md:text-xs', className)} {...props} />;
}

import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { NativeSelect } from './native-select';

export function ComboBox({ className, size: _size, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('min-w-0 [&>div]:w-full', className)}>
      <NativeSelect size="sm" className="text-xs" {...props} />
    </div>
  );
}

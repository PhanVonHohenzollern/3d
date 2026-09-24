import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface PushButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  variant?: 'outline' | 'primary';
  sizeClassName?: string;
}

export function PushButton({
  checked = false,
  variant = 'outline',
  sizeClassName = 'h-8 px-3 py-1.5',
  className,
  type = 'button',
  ...props
}: PushButtonProps) {
  return (
    <Button
      type={type}
      variant={checked || variant === 'primary' ? 'default' : 'outline'}
      size="sm"
      className={cn('text-xs', sizeClassName, className)}
      {...props}
    />
  );
}

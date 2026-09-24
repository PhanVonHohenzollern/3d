import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

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
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border text-xs font-medium whitespace-nowrap shadow-xs transition-colors disabled:pointer-events-none disabled:opacity-50',
        checked || variant === 'primary'
          ? 'border-transparent bg-primary text-primary-foreground enabled:hover:opacity-85'
          : 'border-line bg-base text-fg enabled:hover:bg-secondary',
        sizeClassName,
        className,
      )}
      {...props}
    />
  );
}

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  sizeClassName?: string;
}

export function ToolButton({
  sizeClassName = 'h-8 px-3 py-1.5',
  className,
  type = 'button',
  ...props
}: ToolButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-base text-xs font-medium text-fg shadow-xs transition-colors enabled:hover:bg-secondary disabled:pointer-events-none disabled:opacity-50',
        sizeClassName,
        className,
      )}
      {...props}
    />
  );
}

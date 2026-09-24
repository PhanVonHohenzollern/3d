import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  sizeClassName?: string;
}

export function ToolButton({
  sizeClassName = 'min-h-[22px] px-2 py-0.5',
  className,
  type = 'button',
  ...props
}: ToolButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'cursor-default rounded-qt border border-line-strong bg-linear-to-b/srgb from-button-top to-button-bottom text-fg enabled:hover:border-line-hover enabled:active:bg-button-pressed enabled:active:bg-none disabled:text-disabled',
        sizeClassName,
        className,
      )}
      {...props}
    />
  );
}

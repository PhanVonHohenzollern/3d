import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface PushButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  sizeClassName?: string;
}

export function PushButton({
  checked = false,
  sizeClassName = 'min-h-6 px-3 py-0.5',
  className,
  type = 'button',
  ...props
}: PushButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'cursor-default rounded-qt border border-line-strong focus-visible:outline-1 focus-visible:-outline-offset-3 focus-visible:outline-highlight enabled:hover:border-line-hover enabled:active:bg-button-pressed enabled:active:bg-none disabled:border-line disabled:text-disabled',
        checked
          ? 'bg-orientation-checked font-bold text-orientation-checked-fg'
          : 'bg-linear-to-b/srgb from-button-top to-button-bottom text-fg',
        sizeClassName,
        className,
      )}
      {...props}
    />
  );
}

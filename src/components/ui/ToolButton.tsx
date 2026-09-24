import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

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
    <Button type={type} variant="outline" size="sm" className={cn('text-xs', sizeClassName, className)} {...props} />
  );
}

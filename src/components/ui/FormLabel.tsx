import { Label } from './label';
import type { LabelHTMLAttributes } from 'react';

export function FormLabel({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <Label
      className="text-xs font-medium whitespace-nowrap text-muted-foreground group-disabled/form:text-disabled"
      {...props}
    >
      {children}
    </Label>
  );
}

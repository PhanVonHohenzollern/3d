import type { LabelHTMLAttributes } from 'react';

export function FormLabel({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="text-xs font-medium whitespace-nowrap text-muted group-disabled/form:text-disabled" {...props}>
      {children}
    </label>
  );
}

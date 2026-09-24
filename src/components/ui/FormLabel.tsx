import type { ReactNode } from 'react';

export function FormLabel({ children }: { children: ReactNode }) {
  return <label className="whitespace-nowrap group-disabled/form:text-disabled">{children}</label>;
}

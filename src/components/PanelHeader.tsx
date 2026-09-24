import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PanelHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-base px-4">
      <Icon className="size-3.5 text-muted" aria-hidden />
      <h2 className="text-xs font-medium">{title}</h2>
      <div className="flex-1" />
      {children}
    </div>
  );
}

import type { PanelHeaderProps } from '../types/panelHeader';

export function PanelHeader({ icon: Icon, title, children }: PanelHeaderProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 bg-base">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <h2 className="shrink-0 text-xs font-medium">{title}</h2>
      <div className="flex-1" />
      {children}
    </div>
  );
}

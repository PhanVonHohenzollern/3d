import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DockTab<Id extends string> {
  id: Id;
  title: string;
  icon: LucideIcon;
  hint?: string;
  count?: number;
  content: ReactNode;
}

export interface DockAreaProps<Id extends string> {
  label: string;
  height: number;
  tabs: readonly DockTab<Id>[];
  active: Id;
  onActivate: (id: Id) => void;
}

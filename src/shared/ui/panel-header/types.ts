import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  titleAction?: ReactNode;
  children?: ReactNode;
}

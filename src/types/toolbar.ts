import type { Action } from '@/shared/lib/action';
import type { ActionListItem } from '@/types/mainWindow';

export interface ToolBarProps {
  items: readonly ActionListItem[];
}

export interface ToolBarButtonProps {
  action: Action;
}

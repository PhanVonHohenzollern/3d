import type { Action } from '@/hooks/mainWindow/Action';
import type { ActionListItem } from '@/types/mainWindow';

export interface ToolBarProps {
  items: readonly ActionListItem[];
}

export interface ToolBarButtonProps {
  action: Action;
}

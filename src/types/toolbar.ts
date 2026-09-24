import type { Action } from '../hooks/mainWindow/Action';
import type { ActionListItem } from './mainWindow';

export interface ToolBarProps {
  items: readonly ActionListItem[];
}

export interface ToolBarButtonProps {
  action: Action;
}

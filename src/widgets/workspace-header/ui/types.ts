import type { ModelFileControlsProps } from '@/features/model-files';
import type { Action } from '@/shared/lib/action';
import type { ActionListItem } from '@/widgets/workspace-header/model/types';

export type Theme = 'light' | 'dark';

export interface WorkspaceHeaderProps {
  files: ModelFileControlsProps;
  theme: Theme;
  onToggleTheme: () => void;
}

export interface ToolBarProps {
  items: readonly ActionListItem[];
}

export interface ToolBarButtonProps {
  action: Action;
}

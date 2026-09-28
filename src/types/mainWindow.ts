import type { Action } from '@/hooks/mainWindow/Action';

export type DockName = 'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'LinkDock' | 'SubParametersDock';

export type PreviewMode = 'build' | 'debug';

export interface Dock {
  name: DockName;
  title: string;
}

export type ActionListItem = Action | 'separator';

export interface Menu {
  title: string;
  items: readonly ActionListItem[];
}

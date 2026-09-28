import type { Action } from '@/shared/lib/action';

export type DockName = 'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'LinkDock' | 'SubParametersDock';

export type { PreviewMode } from '@/features/run-preview';

export interface Dock {
  name: DockName;
  title: string;
}

export type ActionListItem = Action | 'separator';

export interface Menu {
  title: string;
  items: readonly ActionListItem[];
}

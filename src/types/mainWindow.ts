import type { Action } from '../hooks/mainWindow/Action';

export type DockName = 'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'LinkDock';

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

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

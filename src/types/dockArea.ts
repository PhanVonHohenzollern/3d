import type { ReactNode } from 'react';
import type { Dock, DockName } from './mainWindow';

export interface DockTab extends Dock {
  selected: boolean;
  raise: () => void;
}

export type InspectorCounts = Record<Exclude<DockName, 'LinkDock' | 'SubParametersDock'>, number>;

export interface DockAreaProps {
  height: number;
  title: string;
  tabs: readonly DockTab[];
  counts: InspectorCounts;
  panels: Record<DockName, ReactNode>;
}

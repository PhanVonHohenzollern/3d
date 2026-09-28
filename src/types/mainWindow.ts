export type DockName = 'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'LinkDock' | 'SubParametersDock';

export interface Dock {
  name: DockName;
  title: string;
}

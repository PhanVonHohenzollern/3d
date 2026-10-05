export type DockName =
  'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'SubApiTraceDock' | 'LinkDock' | 'SubParametersDock';

export type InspectorCounts = Record<Exclude<DockName, 'LinkDock' | 'SubParametersDock' | 'SubApiTraceDock'>, number>;

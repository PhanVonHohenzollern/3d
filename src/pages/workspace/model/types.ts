export type DockName = 'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'LinkDock' | 'SubParametersDock';

export type InspectorCounts = Record<Exclude<DockName, 'LinkDock' | 'SubParametersDock'>, number>;

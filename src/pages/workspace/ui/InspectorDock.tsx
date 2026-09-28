import type { ReactNode } from 'react';
import { kDocks } from '@/pages/workspace/config/docks';
import { DockArea, type DockTab } from '@/shared/ui/dock';
import type { DockName, InspectorCounts } from '@/pages/workspace/model/types';

type InspectorDockProps = {
  height: number;
  raised: DockName;
  onRaise: (name: DockName) => void;
  showSubParameters: boolean;
  counts: InspectorCounts;
  panels: Record<DockName, ReactNode>;
};

function countFor(counts: InspectorCounts, id: DockName): number | undefined {
  return id === 'LinkDock' || id === 'SubParametersDock' ? undefined : counts[id];
}

export function InspectorDock({ height, raised, onRaise, showSubParameters, counts, panels }: InspectorDockProps) {
  const tabs = kDocks
    .filter((dock) => showSubParameters || dock.id !== 'SubParametersDock')
    .map((dock): DockTab<DockName> => ({ ...dock, count: countFor(counts, dock.id), content: panels[dock.id] }));

  return <DockArea label="Inspector" height={height} tabs={tabs} active={raised} onActivate={onRaise} />;
}

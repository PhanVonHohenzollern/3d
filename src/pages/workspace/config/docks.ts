import { Braces, Link2, ListTree, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { linkPanelMinimumHeight } from '@/features/edit-connector';
import type { DockName } from '@/pages/workspace/model/types';

export const kDocks: readonly { id: DockName; title: string; icon: LucideIcon; hint?: string }[] = [
  { id: 'VariablesDock', title: 'Variables', icon: Braces, hint: 'Inspect values at the cursor' },
  { id: 'ParametersDock', title: 'Parameters', icon: SlidersHorizontal, hint: 'Edit a value to update the preview' },
  { id: 'ApiTraceDock', title: 'API Trace', icon: ListTree, hint: 'Select a call to highlight its geometry' },
  { id: 'LinkDock', title: 'Link', icon: Link2 },
  {
    id: 'SubParametersDock',
    title: 'Sub-Parameter',
    icon: SlidersHorizontal,
    hint: 'Enter arguments for a standalone function preview',
  },
];

export function inspectorMinimumHeight(raised: DockName): ((areaWidth: number) => number) | undefined {
  return raised === 'LinkDock' ? linkPanelMinimumHeight : undefined;
}

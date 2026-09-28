import type { Dock } from '@/types/mainWindow';
import { kSplitterHandleSize } from '@/shared/ui/splitter';

export const kDocks: readonly Dock[] = [
  { name: 'VariablesDock', title: 'Variables' },
  { name: 'ParametersDock', title: 'Parameters' },
  { name: 'ApiTraceDock', title: 'API Trace' },
  { name: 'LinkDock', title: 'Link' },
];

const kMinimumDockHeight = 200;
const kMinimumCentralHeight = 252;

export function clampDockHeight(height: number, areaHeight: number): number {
  const available = Math.max(0, areaHeight - kSplitterHandleSize - 12);
  const maximum = available - Math.min(kMinimumCentralHeight, available / 2);

  return Math.min(Math.max(height, Math.min(kMinimumDockHeight, maximum)), maximum);
}

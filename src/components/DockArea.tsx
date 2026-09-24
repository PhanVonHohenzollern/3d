import type { ReactNode } from 'react';
import type { Dock, DockName } from '../types/mainWindow';
import { cn } from '../utils/cn';
import { preventDefault } from '../utils/events';

interface DockTab extends Dock {
  selected: boolean;
  raise: () => void;
}

interface DockAreaProps {
  height: number;
  title: string;
  tabs: readonly DockTab[];
  panels: Record<DockName, ReactNode>;
}

export function DockArea({ height, title, tabs, panels }: DockAreaProps) {
  return (
    <div className="flex min-h-0 flex-none flex-col bg-window" style={{ height }}>
      <div className="h-[22px] flex-none border border-b-0 border-line bg-linear-to-b/srgb from-bar-top to-bar-bottom px-1.5 leading-[22px]">
        {title}
      </div>
      <div className="relative min-h-0 flex-1 border border-line bg-window">
        {tabs.map((tab) => (
          <div
            key={tab.name}
            hidden={!tab.selected}
            className="absolute inset-0 flex min-h-0 flex-col *:min-h-0 *:flex-1"
          >
            {panels[tab.name]}
          </div>
        ))}
      </div>
      <div role="tablist" className="flex h-[25px] flex-none px-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            role="tab"
            aria-selected={tab.selected}
            tabIndex={-1}
            className={cn(
              '-mt-px rounded-b-qt border border-t-0 border-line px-3 text-fg not-first:-ml-px',
              tab.selected
                ? 'relative h-[calc(100%+1px)] bg-window font-medium'
                : 'bg-linear-to-b/srgb from-bar-top to-bar-bottom',
            )}
            onMouseDown={preventDefault}
            onClick={tab.raise}
          >
            {tab.title}
          </button>
        ))}
      </div>
    </div>
  );
}

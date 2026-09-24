import { Braces, Link2, ListTree, SlidersHorizontal } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Dock, DockName } from '../types/mainWindow';
import { cn } from '../utils/cn';

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

const icons = { VariablesDock: Braces, ParametersDock: SlidersHorizontal, ApiTraceDock: ListTree, LinkDock: Link2 };
const hints = {
  VariablesDock: 'Inspect values at the cursor',
  ParametersDock: 'Edit a value to update the preview',
  ApiTraceDock: 'Explore calls and their source values',
  LinkDock: 'Configure and preview connectors',
};

export function DockArea({ height, title, tabs, panels }: DockAreaProps) {
  const active = tabs.find((tab) => tab.selected);

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].raise();
    document.getElementById(`tab-${tabs[next].name}`)?.focus();
  };

  return (
    <section
      aria-label={`${title} inspector`}
      className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-base shadow-xs"
      style={{ height }}
    >
      <div className="flex min-h-12 shrink-0 items-center gap-4 border-b border-line px-2 sm:px-4">
        <div role="tablist" aria-label="Inspector panels" className="flex items-center gap-1 overflow-x-auto py-2">
          {tabs.map((tab, index) => {
            const Icon = icons[tab.name];

            return (
              <button
                key={tab.name}
                id={`tab-${tab.name}`}
                type="button"
                role="tab"
                aria-selected={tab.selected}
                aria-controls={`panel-${tab.name}`}
                tabIndex={tab.selected ? 0 : -1}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
                  tab.selected ? 'bg-secondary text-fg' : 'text-muted hover:bg-secondary hover:text-fg',
                )}
                onClick={tab.raise}
                onKeyDown={(event) => navigate(event, index)}
              >
                <Icon className="size-3.5" aria-hidden />
                {tab.title}
              </button>
            );
          })}
        </div>
        <span className="ml-auto hidden text-[11px] text-muted lg:inline">{active && hints[active.name]}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.name}
            id={`panel-${tab.name}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.name}`}
            hidden={!tab.selected}
            className="absolute inset-0 flex min-h-0 flex-col *:min-h-0 *:flex-1"
          >
            {panels[tab.name]}
          </div>
        ))}
      </div>
    </section>
  );
}

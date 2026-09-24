import { Braces, Link2, ListTree, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Dock, DockName } from '../types/mainWindow';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

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

  return (
    <Tabs
      value={active?.name}
      onValueChange={(name) => tabs.find((tab) => tab.name === name)?.raise()}
      aria-label={`${title} inspector`}
      className="flex min-h-0 shrink-0 flex-col gap-0 overflow-hidden rounded-lg border border-line bg-base shadow-xs"
      style={{ height }}
    >
      <div className="flex min-h-11 shrink-0 items-center gap-4 border-b border-line px-2 sm:px-4">
        <TabsList
          variant="line"
          aria-label="Inspector panels"
          className="max-w-full justify-start overflow-x-auto p-0 group-data-[orientation=horizontal]/tabs:h-11"
        >
          {tabs.map((tab) => {
            const Icon = icons[tab.name];

            return (
              <TabsTrigger
                key={tab.name}
                value={tab.name}
                className="shrink-0 rounded-none px-2 text-xs group-data-[orientation=horizontal]/tabs:after:bottom-0 hover:bg-secondary/50 data-[state=active]:font-semibold sm:px-3"
              >
                <Icon className="size-3.5" aria-hidden />
                {tab.title}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
          {active && hints[active.name]}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <TabsContent
            key={tab.name}
            value={tab.name}
            forceMount
            hidden={!tab.selected}
            className="absolute inset-0 m-0 flex min-h-0 flex-col *:min-h-0 *:flex-1"
          >
            {panels[tab.name]}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

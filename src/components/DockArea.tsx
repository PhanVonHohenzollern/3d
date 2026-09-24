import { Braces, Info, Link2, ListTree, SlidersHorizontal } from 'lucide-react';
import type { DockAreaProps } from '../types/dockArea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

const icons = { VariablesDock: Braces, ParametersDock: SlidersHorizontal, ApiTraceDock: ListTree, LinkDock: Link2 };
const hints = {
  VariablesDock: 'Inspect values at the cursor',
  ParametersDock: 'Edit a value to update the preview',
  ApiTraceDock: 'Explore calls and their source values',
  LinkDock: 'Configure and preview connectors',
};

export function DockArea({ height, title, tabs, counts, panels }: DockAreaProps) {
  const active = tabs.find((tab) => tab.selected);

  return (
    <Tabs
      value={active?.name}
      onValueChange={(name) => tabs.find((tab) => tab.name === name)?.raise()}
      aria-label={`${title} inspector`}
      className="workspace-panel @container flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden border border-line bg-base shadow-xs"
      style={{ height }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2">
        <TabsList
          aria-label="Inspector panels"
          className="max-w-full justify-start gap-0.5 overflow-x-auto rounded-[7px] bg-secondary p-[3px] group-data-[orientation=horizontal]/tabs:h-8"
        >
          {tabs.map((tab) => {
            const Icon = icons[tab.name];

            return (
              <TabsTrigger
                key={tab.name}
                value={tab.name}
                className="h-[26px] shrink-0 rounded-[4px] px-2.5 py-0 text-xs data-[state=active]:bg-base data-[state=active]:font-medium dark:data-[state=active]:bg-base"
              >
                <Icon className="size-3.5" aria-hidden />
                {tab.title}
                {tab.name !== 'LinkDock' && (
                  <span className="rounded-sm bg-line px-1 font-code text-[10px] tabular-nums">{counts[tab.name]}</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground @3xl:flex">
          <Info className="size-3.5" aria-hidden />
          {active && hints[active.name]}
        </span>
      </div>
      <div className="workspace-surface relative min-h-0 flex-1 overflow-hidden bg-window">
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

import { Info } from 'lucide-react';
import type { DockAreaProps } from '@/shared/ui/dock/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';

// A tabbed dock whose panels stay mounted while hidden, so their scroll and selection survive.
export function DockArea<Id extends string>({ label, height, tabs, active, onActivate }: DockAreaProps<Id>) {
  const activeTab = tabs.find((tab) => tab.id === active);

  return (
    <Tabs
      value={active}
      onValueChange={(id) => {
        const tab = tabs.find((candidate) => candidate.id === id);
        if (tab) onActivate(tab.id);
      }}
      aria-label={`${activeTab?.title ?? ''} ${label.toLowerCase()}`}
      className="workspace-panel @container flex min-h-0 shrink-0 flex-col gap-[var(--panel-inset)] overflow-hidden border border-line bg-base shadow-xs"
      style={{ height }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2">
        <TabsList
          aria-label={`${label} panels`}
          className="w-full min-w-0 justify-start gap-0.5 rounded-[7px] bg-secondary p-[3px] group-data-[orientation=horizontal]/tabs:h-8 @min-[480px]:w-auto"
        >
          {tabs.map(({ id, title, icon: Icon, count }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-[26px] min-w-0 flex-auto gap-1 rounded-[4px] px-1 py-0 text-[11px] data-[state=active]:bg-base data-[state=active]:font-medium @min-[480px]:gap-1.5 @min-[480px]:px-2.5 @min-[480px]:text-xs dark:data-[state=active]:bg-base"
            >
              <Icon className="hidden size-3.5 @min-[480px]:block" aria-hidden />
              <span className="truncate">{title}</span>
              {count !== undefined && (
                <span className="shrink-0 rounded-sm bg-line px-1 font-code text-[10px] tabular-nums">{count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {activeTab?.hint && (
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground @3xl:flex">
            <Info className="size-3.5" aria-hidden />
            {activeTab.hint}
          </span>
        )}
      </div>
      <div className="workspace-surface relative min-h-0 flex-1 overflow-hidden bg-window">
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            forceMount
            hidden={tab.id !== active}
            className="absolute inset-0 m-0 flex min-h-0 flex-col *:min-h-0 *:flex-1"
          >
            {tab.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

import { useSyncExternalStore, type ReactElement } from 'react';
import { Box, Check, CircleDot, MoveUpRight } from 'lucide-react';
import { ContextMenu } from 'radix-ui';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';

const modes = [
  { mode: 'Mesh', icon: Box },
  { mode: 'Point', icon: CircleDot },
  { mode: 'Vector', icon: MoveUpRight },
] as const;

export function SelectionModeMenu({ engine, children }: { engine: ViewportEngine; children: ReactElement }) {
  const selected = useSyncExternalStore(engine.subscribeWidgets, engine.selectionMode);

  return (
    <ContextMenu.Root onOpenChange={(open) => open && engine.leaveEvent()}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          aria-label="Selection mode"
          className="z-50 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          collisionPadding={8}
        >
          <ContextMenu.RadioGroup value={selected}>
            {modes.map(({ mode, icon: Icon }) => (
              <ContextMenu.RadioItem
                key={mode}
                value={mode}
                onSelect={() => engine.setSelectionMode(mode)}
                className="relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-3 pl-8 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground"
              >
                <ContextMenu.ItemIndicator className="absolute left-2">
                  <Check className="size-3.5" aria-hidden />
                </ContextMenu.ItemIndicator>
                <Icon className="size-3.5" aria-hidden />
                {mode}
              </ContextMenu.RadioItem>
            ))}
          </ContextMenu.RadioGroup>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

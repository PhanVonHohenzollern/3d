import { isMacPlatform } from '../utils/platform';
import { Box, CodeXml } from 'lucide-react';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useDockArea } from '../hooks/useDockArea';
import { useMainWindow } from '../hooks/useMainWindow';
import { ApiTracePanel } from './ApiTracePanel';
import { CodeEditor } from './CodeEditor';
import { DockArea } from './DockArea';
import { LinkPanel } from './LinkPanel';
import { PanelHeader } from './PanelHeader';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ParameterPanel } from './ParameterPanel';
import { Splitter } from './Splitter';
import { StatusBar } from './StatusBar';
import { ToolBar } from './ToolBar';
import { VariablePanel } from './VariablePanel';
import { Viewport3D } from './Viewport3D';

export function App() {
  const mainWindow = useMainWindow();
  const compact = useCompactLayout();
  const { mainAreaRef, dockHeight, onSeparatorPointerDown, title, tabs } = useDockArea(
    mainWindow.raisedDock,
    mainWindow.raiseDock,
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-window select-none">
      <WorkspaceHeader menus={mainWindow.menus} />
      <ToolBar items={mainWindow.toolbarItems} />
      <main ref={mainAreaRef} className="flex min-h-0 flex-1 flex-col px-2 pb-3 sm:px-5">
        <div className="min-h-0 flex-1">
          <Splitter orientation={compact ? 'vertical' : 'horizontal'} initialSizes={[600, 900]} stretchFactors={[4, 6]}>
            <section
              aria-label="Code Editor"
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-base shadow-xs"
            >
              <PanelHeader icon={CodeXml} title="Code Editor">
                <span className="rounded border border-line px-1.5 py-0.5 font-code text-[10px] text-muted-foreground">
                  C++
                </span>
              </PanelHeader>
              <div className="min-h-0 flex-1">
                <CodeEditor {...mainWindow.editor} />
              </div>
              <div className="flex h-7 shrink-0 items-center gap-1.5 border-t border-line px-4 text-[10px] text-muted-foreground">
                <kbd className="rounded border border-line px-1 font-ui">
                  {isMacPlatform ? '⌘⇧Space' : 'Ctrl Space'}
                </kbd>{' '}
                for suggestions
              </div>
            </section>
            <section
              aria-label="3D Viewport"
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-base shadow-xs"
            >
              <PanelHeader icon={Box} title="3D Viewport">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-1 rounded-full bg-emerald-500" /> Live
                </span>
              </PanelHeader>
              <div className="relative min-h-0 flex-1 overflow-hidden bg-viewport">
                <Viewport3D {...mainWindow.viewport} />
              </div>
            </section>
          </Splitter>
        </div>
        <div
          className="group flex h-3 flex-none cursor-row-resize touch-none items-center justify-center"
          onPointerDown={onSeparatorPointerDown}
          title="Resize inspector"
        >
          <span className="h-0.5 w-8 rounded-full bg-line transition-colors group-hover:bg-line-hover" />
        </div>
        <DockArea
          height={dockHeight}
          title={title}
          tabs={tabs}
          panels={{
            VariablesDock: <VariablePanel {...mainWindow.variables} />,
            ParametersDock: <ParameterPanel {...mainWindow.parameters} />,
            ApiTraceDock: <ApiTracePanel {...mainWindow.apiTrace} />,
            LinkDock: <LinkPanel {...mainWindow.links} />,
          }}
        />
      </main>
      <StatusBar model={mainWindow.statusBar} />
    </div>
  );
}

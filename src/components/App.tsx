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
import { ResizeHandle } from './ResizeHandle';
import { Splitter } from './Splitter';
import { StatusBar } from './StatusBar';
import { ToolBar } from './ToolBar';
import { VariablePanel } from './VariablePanel';
import { Viewport3D } from './Viewport3D';

export function App() {
  const mainWindow = useMainWindow();
  const compact = useCompactLayout();
  const { mainAreaRef, dockHeight, onSeparatorPointerDown, onSeparatorKeyDown, minimum, maximum, title, tabs } =
    useDockArea(mainWindow.raisedDock, mainWindow.raiseDock);

  return (
    <div className="flex h-dvh w-full flex-col overflow-x-hidden overflow-y-auto bg-window select-none">
      <WorkspaceHeader />
      <main className="flex min-h-[1000px] flex-1 flex-col px-2 pb-3 sm:px-5 md:min-h-[600px]">
        <div className="min-h-0 flex-1">
          <Splitter
            label="Resize editor and viewport"
            orientation={compact ? 'vertical' : 'horizontal'}
            initialSizes={compact ? [320, 680] : [330, 670]}
            stretchFactors={compact ? [0, 1] : [33, 67]}
          >
            <section
              aria-label="Code Editor"
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-base shadow-xs"
            >
              <PanelHeader icon={CodeXml} title="Code Editor">
                <span className="font-code text-xs text-muted-foreground">C++</span>
              </PanelHeader>
              <div className="min-h-0 flex-1">
                <CodeEditor {...mainWindow.editor} />
              </div>
            </section>
            <div className="flex h-full min-w-0 flex-col">
              <div ref={mainAreaRef} className="flex min-h-0 flex-1 flex-col">
                <section
                  aria-label="3D Viewport"
                  className="@container/preview flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-base shadow-xs"
                >
                  <PanelHeader icon={Box} title="3D Viewport">
                    <ToolBar items={mainWindow.toolbarItems} />
                  </PanelHeader>
                  <div className="relative min-h-0 flex-1 overflow-hidden bg-viewport">
                    <Viewport3D {...mainWindow.viewport} />
                  </div>
                </section>
                <ResizeHandle
                  orientation="horizontal"
                  label="Resize inspector"
                  value={dockHeight}
                  min={minimum}
                  max={maximum}
                  onPointerDown={onSeparatorPointerDown}
                  onKeyDown={onSeparatorKeyDown}
                />
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
              </div>
            </div>
          </Splitter>
        </div>
      </main>
      <StatusBar model={mainWindow.statusBar} />
    </div>
  );
}

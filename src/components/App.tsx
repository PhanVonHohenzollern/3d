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
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-window select-none [@media(max-height:600px)]:overflow-y-auto">
      <WorkspaceHeader />
      <ToolBar items={mainWindow.toolbarItems} />
      <main
        ref={mainAreaRef}
        className="flex min-h-0 flex-1 flex-col px-2 pb-3 sm:px-5 [@media(max-height:600px)]:min-h-[480px]"
      >
        <div className="min-h-0 flex-1">
          <Splitter
            label="Resize editor and viewport"
            orientation={compact ? 'vertical' : 'horizontal'}
            initialSizes={[450, 550]}
            stretchFactors={[45, 55]}
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
            <section
              aria-label="3D Viewport"
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-base shadow-xs"
            >
              <PanelHeader icon={Box} title="3D Viewport" />
              <div className="relative min-h-0 flex-1 overflow-hidden bg-viewport">
                <Viewport3D {...mainWindow.viewport} />
              </div>
            </section>
          </Splitter>
        </div>
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
      </main>
      <StatusBar model={mainWindow.statusBar} />
    </div>
  );
}

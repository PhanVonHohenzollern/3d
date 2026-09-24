import { useDockArea } from '../hooks/useDockArea';
import { useMainWindow } from '../hooks/useMainWindow';
import { ApiTracePanel } from './ApiTracePanel';
import { CodeEditor } from './CodeEditor';
import { DockArea } from './DockArea';
import { LinkPanel } from './LinkPanel';
import { MenuBar } from './MenuBar';
import { ParameterPanel } from './ParameterPanel';
import { Splitter } from './Splitter';
import { StatusBar } from './StatusBar';
import { ToolBar } from './ToolBar';
import { VariablePanel } from './VariablePanel';
import { Viewport3D } from './Viewport3D';

export function App() {
  const mainWindow = useMainWindow();
  const { mainAreaRef, dockHeight, onSeparatorPointerDown, title, tabs } = useDockArea(
    mainWindow.raisedDock,
    mainWindow.raiseDock,
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden select-none">
      <MenuBar menus={mainWindow.menus} />
      <ToolBar items={mainWindow.toolbarItems} />
      <div ref={mainAreaRef} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <Splitter orientation="horizontal" initialSizes={[600, 900]} stretchFactors={[4, 6]}>
            <CodeEditor {...mainWindow.editor} />
            <div className="relative h-full w-full overflow-hidden bg-viewport *:h-full *:w-full">
              <Viewport3D {...mainWindow.viewport} />
            </div>
          </Splitter>
        </div>
        <div
          className="h-[5px] flex-none cursor-row-resize touch-none bg-window hover:bg-handle-hover"
          onPointerDown={onSeparatorPointerDown}
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
      <StatusBar model={mainWindow.statusBar} />
    </div>
  );
}

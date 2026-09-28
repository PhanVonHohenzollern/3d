import { Button } from '@/shared/ui/button';
import { Box, CodeXml } from 'lucide-react';
import { useCompactLayout } from '@/shared/lib/react';
import { useDockHeight } from '@/shared/ui/dock';
import { useWorkspace } from '@/pages/workspace/model/useWorkspace';
import { ApiTracePanel } from '@/widgets/api-trace-panel';
import { CodeEditor } from '@/widgets/code-editor';
import { inspectorMinimumHeight } from '@/pages/workspace/config/docks';
import { InspectorDock } from '@/pages/workspace/ui/InspectorDock';
import { LinkPanel } from '@/widgets/link-panel';
import { PanelHeader } from '@/shared/ui/panel-header';
import { WorkspaceHeader, type Theme } from '@/widgets/workspace-header';
import { ParameterPanel } from '@/widgets/parameter-panel';
import { ResizeHandle } from '@/shared/ui/splitter';
import { Splitter } from '@/shared/ui/splitter';
import { ToolBar } from '@/widgets/workspace-header';
import { VariablePanel } from '@/widgets/variable-panel';
import { Viewport3D } from '@/widgets/viewport';
import { FunctionEditor } from '@/features/manage-functions';
import { PreviewModeToggle } from '@/features/run-preview';
import { SubParameterPanel } from '@/features/manage-functions';

type WorkspacePageProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

export function WorkspacePage({ theme, onToggleTheme }: WorkspacePageProps) {
  const workspace = useWorkspace();
  const compact = useCompactLayout();
  const { mainAreaRef, dockHeight, onSeparatorPointerDown, onSeparatorKeyDown, minimum, maximum } = useDockHeight(
    inspectorMinimumHeight(workspace.raisedDock),
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-x-hidden overflow-y-auto bg-window select-none">
      <WorkspaceHeader files={workspace.files.controls} theme={theme} onToggleTheme={onToggleTheme} />
      {workspace.files.message && (
        <div
          role={workspace.files.error ? 'alert' : 'status'}
          className="flex items-center gap-2 border-b border-line bg-base px-3 py-2 text-xs"
        >
          <span
            className={workspace.files.error ? 'min-w-0 flex-1 text-error' : 'min-w-0 flex-1 text-muted-foreground'}
          >
            {workspace.files.message}
          </span>
          <Button variant="ghost" size="sm" onClick={workspace.files.dismissMessage}>
            Dismiss
          </Button>
        </div>
      )}
      <main className="flex min-h-[1000px] flex-1 flex-col p-3 md:min-h-[600px]">
        <div className="min-h-0 flex-1">
          <Splitter
            label="Resize editor and viewport"
            orientation={compact ? 'vertical' : 'horizontal'}
            initialSizes={compact ? [320, 680] : [330, 670]}
            stretchFactors={compact ? [0, 1] : [33, 67]}
          >
            <section
              aria-label="Code Editor"
              className="workspace-panel @container/editor flex h-full min-w-0 flex-col overflow-hidden border border-line bg-base shadow-xs"
            >
              <PanelHeader icon={CodeXml} title="Code Editor">
                <span className="workspace-surface hidden bg-secondary px-2 py-1 font-code text-xs text-muted-foreground @min-[340px]/editor:inline">
                  C++
                </span>
                <PreviewModeToggle
                  mode={workspace.previewMode}
                  debugBlocked={workspace.debugBlocked}
                  onBuild={workspace.buildPreview}
                  onDebug={workspace.debugPreview}
                />
              </PanelHeader>
              <FunctionEditor.Provider state={workspace.functions.state} actions={workspace.functions.actions}>
                <FunctionEditor.Tabs />
                <FunctionEditor.Error />
                <div className="workspace-surface min-h-0 flex-1 overflow-hidden">
                  <CodeEditor
                    {...workspace.editor}
                    footer={
                      <>
                        <FunctionEditor.Actions />
                        <FunctionEditor.AddDialog />
                      </>
                    }
                  />
                </div>
              </FunctionEditor.Provider>
            </section>
            <div className="flex h-full min-w-0 flex-col">
              <div ref={mainAreaRef} className="flex min-h-0 flex-1 flex-col">
                <section
                  aria-label="3D Viewport"
                  className="workspace-panel @container/preview flex min-h-0 flex-1 flex-col overflow-hidden border border-line bg-base shadow-xs"
                >
                  <PanelHeader icon={Box} title="3D Viewport">
                    <ToolBar items={workspace.toolbarItems} />
                  </PanelHeader>
                  <div className="workspace-surface relative min-h-0 flex-1 overflow-hidden bg-viewport">
                    <Viewport3D {...workspace.viewport} />
                    {workspace.importedObj && (
                      <div className="absolute top-2 right-2 left-2 flex items-center gap-2 rounded-md border border-line bg-base/95 p-2 text-xs">
                        <span className="min-w-0 flex-1 truncate" title={workspace.importedObj.name}>
                          OBJ preview · {workspace.importedObj.name}
                        </span>
                        <Button size="sm" variant="outline" onClick={workspace.returnToCodePreview}>
                          Return to code
                        </Button>
                      </div>
                    )}
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
                {workspace.importedObj ? (
                  <section
                    aria-label="Imported model inspector"
                    style={{ height: dockHeight }}
                    className="workspace-panel flex shrink-0 flex-col items-center justify-center gap-2 border border-line bg-base p-3 text-center text-xs"
                  >
                    <p className="font-medium">Imported OBJ model</p>
                    <p className="text-muted-foreground">OBJ contains mesh geometry, not editable C++ parameters.</p>
                    <Button size="sm" variant="outline" onClick={workspace.returnToCodePreview}>
                      Return to code preview
                    </Button>
                  </section>
                ) : null}
                <div className={workspace.importedObj ? 'hidden' : 'contents'}>
                  <InspectorDock
                    height={dockHeight}
                    raised={workspace.raisedDock}
                    onRaise={workspace.raiseDock}
                    showSubParameters={workspace.subParameters.enabled}
                    counts={workspace.inspectorCounts}
                    panels={{
                      VariablesDock: <VariablePanel {...workspace.variables} />,
                      ParametersDock: <ParameterPanel {...workspace.parameters} />,
                      ApiTraceDock: <ApiTracePanel {...workspace.apiTrace} />,
                      LinkDock: <LinkPanel {...workspace.links} />,
                      SubParametersDock: <SubParameterPanel {...workspace.subParameters} />,
                    }}
                  />
                </div>
              </div>
            </div>
          </Splitter>
        </div>
      </main>
    </div>
  );
}

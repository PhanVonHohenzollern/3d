import { isApiDebugItemId } from '@/entities/api-call';
import type { FunctionWorkspace } from '@/entities/source-function';
import type { ImportedModel } from '@/features/model-files';
import type { PreviewSession } from '@/features/run-preview';
import type { StatusBarModel } from '@/pages/workspace/model/StatusBarModel';
import type { SingleShotTimer } from '@/shared/lib/SingleShotTimer';
import type { ApiTracePanelHandle } from '@/widgets/api-trace-panel';
import type { CodeEditorHandle } from '@/widgets/code-editor';
import type { VariablePanelHandle } from '@/widgets/variable-panel';
import type { Viewport3DHandle } from '@/widgets/viewport';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '@engine/runtime';

export interface SelectionHost {
  readonly editor: CodeEditorHandle;
  readonly viewport: Viewport3DHandle;
  readonly variables: VariablePanelHandle;
  readonly apiTrace: ApiTracePanelHandle;
  readonly session: PreviewSession;
  readonly functions: FunctionWorkspace;
  readonly importedObj: ImportedModel | null;
  readonly previewTimer: SingleShotTimer;
  statusBar(): StatusBarModel;
  selectFunction(name: string, apiIndex?: number): void;
  openSourceFile(name: string): void;
}

// Keeps the editor, viewport, Variables and API Trace pointing at the same thing: selecting in
// one of them highlights the matching source lines, debug items and API calls in the others.
export class SelectionSync {
  // While true, the preview stays at the line it ran to instead of following the cursor.
  browsingTrace = false;
  #navigating = false;

  constructor(readonly host: SelectionHost) {}

  get navigating(): boolean {
    return this.#navigating;
  }

  readonly onApiTraceSelectionChanged = (apiIndex: number): void => {
    const { viewport, apiTrace, editor } = this.host;
    this.applyApiFocus(apiIndex);
    viewport.setSelectedVariables(apiTrace.selectedDebugItems());
    editor.setTraceSourceLines(this.localLines(apiTrace.selectedSourceLines()));
  };

  readonly onApiTraceSourceActivated = (line: number): void => {
    this.navigateToSource(line, this.host.apiTrace.selectedSourceLines());
  };

  readonly onApiTraceFunctionActivated = (apiIndex: number): void => {
    const { session, functions } = this.host;
    const call = session.lastResult.apiCalls[apiIndex];
    if (!call?.userFunctionCall) return;
    const name = functions.tabForCall(call);
    if (!name) {
      this.host.statusBar().showMessage('Function tab not found.', 2600);

      return;
    }
    this.host.selectFunction(name, apiIndex);
    this.host.editor.setFocus();
  };

  readonly onApiTraceHistorySourceActivated = (line: number): void => {
    this.navigateToSource(line, new Set([line]));
  };

  readonly onVariableSelectionChanged = (name: string): void => {
    this.selectRuntimeDebugVariables(new Set([name]));
  };

  readonly onViewportSelectionChanged = (names: Set<string>): void => {
    const parameters = new Set<string>();
    for (const name of names) if (isApiDebugItemId(name)) parameters.add(name);
    if (parameters.size || this.host.viewport.hasApiFocus()) this.host.apiTrace.selectDebugItems(parameters);
    else this.selectRuntimeDebugVariables(names);
  };

  readonly onViewportMeshSelection = (apiIndex: number, sourceLine: number): void => {
    if (this.host.importedObj || apiIndex < 0) return;
    this.host.apiTrace.selectMeshApiCall(apiIndex);
    this.navigateToSource(sourceLine, new Set([sourceLine]));
  };

  // Trace locations use combined-program lines; the editor shows lines in the original file.
  navigateToSource(line: number, lines: ReadonlySet<number>): void {
    const { session, functions, editor } = this.host;
    const previewProgram = session.program;
    if (previewProgram) {
      const location = previewProgram.locations.findLast((entry) => line >= entry.start && line <= entry.end);
      if (location) {
        const localLine = line - location.start + location.localStart;
        const localLines = new Set(
          [...lines]
            .filter((value) => value >= location.start && value <= location.end)
            .map((value) => value - location.start + location.localStart),
        );
        if (location.name !== functions.activeFile) this.host.openSourceFile(location.name);
        line = localLine;
        lines = localLines;
      }
    }
    if (line < 1 || line > editor.blockCount()) return;
    const navigation = this.#navigating;
    this.#navigating = true;
    try {
      this.browsingTrace = true;
      this.host.previewTimer.stop();
      editor.setTextCursorToLine(line);
      editor.centerCursor();
      editor.setTraceSourceLines(lines, line);
      this.host.statusBar().showMessage(`Source line ${line} - keeping preview at line ${session.currentLine}`, 3000);
    } finally {
      this.#navigating = navigation;
    }
  }

  private localLines(lines: ReadonlySet<number>): Set<number> {
    const location = this.host.session.program?.locations.find(
      (entry) => entry.name === this.host.functions.activeFile,
    );

    return new Set(
      [...lines]
        .filter((line) => !location || (line >= location.start && line <= location.end))
        .map((line) => (location ? line - location.start + 1 : line)),
    );
  }

  selectRuntimeDebugVariables(selection: ReadonlySet<string>): void {
    const { apiTrace, viewport, variables, editor, session } = this.host;
    // clearApiFocus() re-entrantly resets the viewport selection, which may be the Set passed in.
    const names = new Set(selection);
    if (apiTrace.selectedApiCall() >= 0) apiTrace.clearApiFocus();
    viewport.setSelectedVariables(names);
    const lines = new Set<number>();
    let primary = '';
    let primaryLine = 0;
    for (const variable of session.lastResult.variables) {
      const name = variable.name;
      if (!names.has(name)) continue;
      if (variable.lastChangedLine > 0) lines.add(variable.lastChangedLine);
      primary = name;
      primaryLine = variable.lastChangedLine;
    }
    if (primary !== '') variables.selectVariable(primary);
    if (primaryLine > 0) this.navigateToSource(primaryLine, lines);
    else editor.setTraceSourceLines(lines);
  }

  applyApiFocus(apiIndex: number): void {
    const { viewport, apiTrace, session, functions } = this.host;
    if (this.host.importedObj) return;
    viewport.setSelectedApiCall(apiIndex, apiIndex >= 0 && apiTrace.meshApiCall() === apiIndex);
    if (apiIndex < 0 || apiIndex >= session.lastResult.apiCalls.length) {
      viewport.clearApiFocus();
      this.host.statusBar().showMessage('API focus cleared - full preview restored', 1800);

      return;
    }

    const focusedApiIndices = new Set<number>();
    const selectedCalls = apiTrace.selectedApiCalls();
    for (const index of selectedCalls) focusedApiIndices.add(index);
    const debugApiIndices = new Set(selectedCalls);
    const calls = session.lastResult.apiCalls;
    for (let i = 0; i < calls.length; ++i) {
      let parent = calls[i].parentApiIndex;
      while (parent >= 0) {
        if (selectedCalls.has(parent)) {
          focusedApiIndices.add(i);
          // Main shows a sub-function's input points, not its internal API snapshots.
          if (functions.active || !calls[parent].userFunctionCall) debugApiIndices.add(i);
        }
        if (parent >= calls.length) break;
        parent = calls[parent].parentApiIndex;
      }
    }
    viewport.setApiFocusIndices(focusedApiIndices, debugApiIndices);

    const call = calls[apiIndex];
    const snapshotDebugCount = resolveDebugPointSnapshots(call).length + resolveDebugVectorAnchors(call).length;
    this.host
      .statusBar()
      .showMessage(
        `API #${apiIndex + 1} ${call.name} | ${snapshotDebugCount} point/vector input(s), ${focusedApiIndices.size} call(s) in focus`,
        3000,
      );
  }

  // After a new run: show the API call or variable that was selected before it.
  restoreAfterRun(): void {
    const { apiTrace, viewport, variables } = this.host;
    this.applyApiFocus(apiTrace.selectedApiCall());
    const selected = variables.selectedVariable();
    if (apiTrace.selectedApiCall() >= 0) viewport.setSelectedVariables(apiTrace.selectedDebugItems());
    else if (selected !== '') viewport.setSelectedVariable(selected);
  }

  // The selected API trace items, or else the viewport's.
  selectedDebugItems(): Set<string> {
    const names = this.host.apiTrace.selectedDebugItems();

    return names.size ? names : this.host.viewport.selectedDebugItems();
  }
}

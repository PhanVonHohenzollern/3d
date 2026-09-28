import { parameterSlotCount } from '@/entities/parameter';
import { canExportModel, exportedObjText, type ImportedModel } from '@/features/model-files';
import type { DockName, InspectorCounts } from '@/pages/workspace';
import type { ConnectorPreview } from '@engine/geometry';
import type { PreviewGeometryScene } from '@engine/geometry';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '@engine/runtime';
import { emptyRuntimeResult, type RuntimeResult } from '@engine/runtime';
import { PreviewSession, type EditorExecutionFeedback, type PreviewMode } from '@/features/run-preview';
import { isApiDebugItemId } from '@/entities/api-call';
import { closestTarget, floatingWindowSelector, matchesKeySequence, textInputSelector } from '@/shared/lib/qt';
import { pointDeclaration, unusedPreviewPointName } from '@/widgets/viewport';
import type { CodeEditorHandle } from '@/widgets/code-editor';
import { createWorkspaceActions, type ActionListItem } from '@/widgets/workspace-header';
import type { ApiTracePanelHandle } from '@/widgets/api-trace-panel';
import type { VariablePanelHandle } from '@/widgets/variable-panel';
import type { LinkPanelHandle } from '@/features/edit-connector';
import type { ParameterPanelHandle } from '@/features/edit-parameters';
import type { Vec3, Viewport3DHandle } from '@/widgets/viewport';
import { what } from '@engine/runtime';
import { Observable } from '@/shared/lib/observable';
import type { Action } from '@/shared/lib/action';
import { SingleShotTimer } from '@/shared/lib/SingleShotTimer';
import { StatusBarModel } from '@/hooks/mainWindow/StatusBarModel';
import { FunctionWorkspace } from '@/entities/source-function';
import { FunctionTabsController } from '@/features/manage-functions';

export class MainWindow extends Observable {
  #editor: CodeEditorHandle | null = null;
  #viewport: Viewport3DHandle | null = null;
  #variables: VariablePanelHandle | null = null;
  #parameters: ParameterPanelHandle | null = null;
  #apiTrace: ApiTracePanelHandle | null = null;
  #links: LinkPanelHandle | null = null;

  readonly bindEditor = (handle: CodeEditorHandle | null): void => {
    this.#editor = handle;
  };
  readonly bindViewport = (handle: Viewport3DHandle | null): void => {
    this.#viewport = handle;
  };
  readonly bindVariables = (handle: VariablePanelHandle | null): void => {
    this.#variables = handle;
  };
  readonly bindParameters = (handle: ParameterPanelHandle | null): void => {
    this.#parameters = handle;
    handle?.setAvailability((parameters) => this.session.activeParameterKeys(parameters));
  };
  readonly bindApiTrace = (handle: ApiTracePanelHandle | null): void => {
    this.#apiTrace = handle;
  };
  readonly bindLinks = (handle: LinkPanelHandle | null): void => {
    this.#links = handle;
  };

  get m_editor(): CodeEditorHandle {
    return this.#editor!;
  }

  get m_viewport(): Viewport3DHandle {
    return this.#viewport!;
  }

  get m_variables(): VariablePanelHandle {
    return this.#variables!;
  }

  get m_parameters(): ParameterPanelHandle {
    return this.#parameters!;
  }

  get m_apiTrace(): ApiTracePanelHandle {
    return this.#apiTrace!;
  }

  get m_links(): LinkPanelHandle {
    return this.#links!;
  }

  readonly m_previewTimer = new SingleShotTimer(220, () => this.runPreview());
  readonly session = new PreviewSession();
  #switchingEditor = false;
  readonly functions = new FunctionWorkspace();
  readonly functionTabs = new FunctionTabsController(
    this.functions,
    () => this.m_editor,
    () => this.m_parameters,
  );

  get m_runtime() {
    return this.session.runtime;
  }

  get m_geometryScene(): PreviewGeometryScene {
    return this.session.scene;
  }

  get m_lastResult(): RuntimeResult {
    return this.session.lastResult;
  }

  get m_currentPreviewLine(): number {
    return this.session.currentLine;
  }

  get previewMode(): PreviewMode {
    return this.session.mode;
  }

  get buildNumber(): number {
    return this.session.buildNumber;
  }

  get previewDirty(): boolean {
    return this.session.previewDirty;
  }

  get executionFeedback(): EditorExecutionFeedback {
    return this.session.feedback;
  }

  get debugBlocked(): boolean {
    return this.session.debugBlocked;
  }

  get previewStatus(): string {
    return this.session.previewStatus;
  }

  importedObj: ImportedModel | null = null;
  #connectorPreviews: readonly ConnectorPreview[] = [];
  #selectedConnectorId = -1;
  #showGeometryAction: Action | null = null;

  get canExportObj(): boolean {
    return canExportModel(this.importedObj, this.m_geometryScene, this.#connectorPreviews);
  }

  replacePreviewWithObj(scene: PreviewGeometryScene, name: string): void {
    this.importedObj = { scene, name };
    this.#showGeometryAction?.setChecked(true);
    this.m_viewport.clearApiFocus();
    this.m_viewport.setRuntimeResult(emptyRuntimeResult());
    this.m_viewport.setConnectorPreviews([], -1);
    this.m_viewport.setGeometryScene(scene);
    this.m_viewport.fitScene();
    this.changed();
  }

  readonly returnToCodePreview = (): void => {
    this.importedObj = null;
    if (this.previewMode === 'debug') this.runPreview();
    else {
      this.m_viewport.setGeometryScene(this.m_geometryScene);
      this.m_viewport.setRuntimeResult(this.m_lastResult);
      this.applyApiFocus(this.m_apiTrace.selectedApiCall());
    }
    this.m_viewport.setConnectorPreviews(this.#connectorPreviews, this.#selectedConnectorId);
    this.m_viewport.fitScene();
    this.changed();
  };

  exportObj(): string {
    if (!this.importedObj) this.runPreview();

    return exportedObjText(this.importedObj, this.m_geometryScene, this.#connectorPreviews);
  }

  inspectorCounts: InspectorCounts = { VariablesDock: 0, ParametersDock: 0, ApiTraceDock: 0 };
  m_navigatingToTrace = false;
  m_browsingTrace = false;

  readonly #statusBar = new StatusBarModel();
  #raisedDock: DockName = 'ParametersDock';
  toolbarItems: ActionListItem[] = [];
  shortcutActions: Action[] = [];

  constructor() {
    super();
    this.#connectFunctionTabs();
    this.createDockPanels();
    this.createActions();
  }

  statusBar(): StatusBarModel {
    return this.#statusBar;
  }

  start(): void {
    this.m_editor.clear();
    this.m_parameters.setPlaceholderData();
    this.m_apiTrace.setPlaceholderData();
    this.runPreview();
    this.statusBar().showMessage('Geometry Preview ready');
  }

  dispose(): void {
    this.m_previewTimer.stop();
  }

  readonly buildPreview = (): void => {
    this.activatePreviewMode('build');
    this.m_parameters.commitEditor();
    const source = this.m_editor.toPlainText();
    let program: ReturnType<FunctionWorkspace['program']>;
    try {
      program = this.functions.program(source);
    } catch (error) {
      this.functions.reportError(what(error));
      this.changed();

      return;
    }
    this.session.beginBuild();
    this.updatePreview(source.split('\n').length, source, program);
    this.session.recordBuild(this.functions.active, source, program, this.m_parameters.overrides());
    this.changed();
  };

  readonly debugPreview = (): void => {
    if (this.debugBlocked) return;
    this.activatePreviewMode('debug');
    this.runPreview();
  };

  private activatePreviewMode(mode: PreviewMode): void {
    this.m_previewTimer.stop();
    this.session.setMode(mode);
    this.importedObj = null;
    this.m_browsingTrace = false;
    this.m_apiTrace.clearApiFocus();
    this.m_editor.setTraceSourceLines(new Set());
    this.changed();
  }

  readonly onEditorTextChanged = (): void => {
    if (this.#switchingEditor) return;
    this.functions.edit(this.m_editor.toPlainText());
    this.m_editor.setTraceSourceLines(new Set());
    const text = this.m_editor.toPlainText();
    this.session.markEdited(text, () => this.functions.program(text, false).source);
    this.changed();
    this.schedulePreview();
  };

  readonly onEditorCursorPositionChanged = (): void => {
    if (this.#switchingEditor) return;
    if (this.m_navigatingToTrace) return;
    this.m_editor.setTraceSourceLines(new Set());
    this.m_browsingTrace = false;
    this.schedulePreview();
  };

  readonly onParametersChanged = (): void => {
    this.session.markParametersChanged();
    this.changed();
    this.runPreview();
  };

  readonly applyParameters = this.buildPreview;

  readonly addFunction = (name: string): boolean => this.functionTabs.add(name);
  readonly clearFunctionError = (): void => this.functionTabs.clearError();
  readonly selectFunction = (name: string): void => this.functionTabs.select(name);
  readonly saveFunction = (): void => this.functionTabs.save();
  readonly cancelFunction = (): void => this.functionTabs.cancel();
  readonly attachFunction = (): void => this.functionTabs.attach();
  readonly deleteFunction = (): void => this.functionTabs.remove();

  get canEditSubParameters(): boolean {
    return this.functionTabs.canEditInputs;
  }

  readonly setFunctionInput = (
    name: string,
    parameter: string,
    initial: string[],
    index: number,
    value: string,
  ): void => this.functionTabs.setInput(name, parameter, initial, index, value);
  readonly selectFunctionInputs = (name: string): void => this.functionTabs.selectInputs(name);
  readonly applyFunctionInputs = (name: string): void => this.functionTabs.applyInputs(name);

  #connectFunctionTabs(): void {
    const tabs = this.functionTabs;
    tabs.editorSwitched.connect(() => this.showFunctionEditor());
    tabs.stateChanged.connect(() => this.changed());
    tabs.draftCancelled.connect((name) => this.session.forgetBuild(name));
    tabs.functionDeleted.connect((name) => {
      this.m_previewTimer.stop();
      this.session.forgetFunction(name);
    });
    tabs.inputsChanged.connect(() => this.onParametersChanged());
    tabs.applyRequested.connect(() => this.applyParameters());
    tabs.statusMessage.connect((text) => this.statusBar().showMessage(text, 2600));
  }

  private showFunctionEditor(): void {
    this.m_previewTimer.stop();
    this.#switchingEditor = true;
    try {
      this.m_editor.setSource(this.functions.source());
      this.m_editor.setTextCursorToLine(this.m_editor.blockCount());
    } finally {
      this.#switchingEditor = false;
    }
    this.importedObj = null;
    this.m_browsingTrace = false;
    this.m_apiTrace.clearApiFocus();
    this.m_editor.setTraceSourceLines(new Set());
    this.functions.selectInputTab(this.functions.active);
    this.session.clear(this.functions.source());
    this.m_viewport.setGeometryScene(this.m_geometryScene);
    this.m_viewport.setRuntimeResult(this.m_lastResult);
    this.m_variables.setRuntimeResult(this.m_lastResult, 1);
    this.m_apiTrace.setRuntimeResult(this.m_lastResult);
    const currentProgram = this.functions.program(this.functions.source(), false);
    const built = this.session.restoreTab(this.functions.active, this.functions.source(), currentProgram);
    if (this.previewMode === 'build') {
      if (built) {
        this.session.showBuild(built);
        this.updatePreview(built.source.split('\n').length, built.source, built.program, built.parameters);
        this.session.markDriftSince(built, this.m_parameters.overrides(), currentProgram);
      } else this.buildPreview();
    } else this.runPreview();
    const main = this.functions.inline[0];
    this.m_parameters.selectTab(
      this.functions.active || (main && currentProgram.options.functionScopes?.get(main.signature)) || main?.name || '',
    );
    if (!this.canEditSubParameters && this.#raisedDock === 'SubParametersDock') this.#raisedDock = 'ParametersDock';
    this.changed();
  }

  readonly linkExpressionEvaluator = (expression: string): number =>
    this.m_runtime.evaluateNumericExpression(expression);

  readonly onLinkPreviewChanged = (
    previews: readonly ConnectorPreview[],
    selectedId: number,
    tested: boolean,
  ): void => {
    this.#connectorPreviews = previews;
    this.#selectedConnectorId = selectedId;
    this.changed();
    if (this.importedObj) return;
    if (tested) this.m_apiTrace.clearApiFocus();
    this.m_viewport.setConnectorPreviews(previews, selectedId);
    if (tested) this.m_viewport.fitScene();
  };

  readonly onViewportConnectorSelection = (id: number): void => {
    this.m_links.selectConnector(id);
    this.raiseDock('LinkDock');
  };

  readonly onApiTraceSelectionChanged = (apiIndex: number): void => {
    this.applyApiFocus(apiIndex);
    this.m_viewport.setSelectedVariables(this.m_apiTrace.selectedDebugItems());
    this.m_editor.setTraceSourceLines(this.m_apiTrace.selectedSourceLines());
  };

  readonly onApiTraceSourceActivated = (line: number): void => {
    this.navigateToSource(line, this.m_apiTrace.selectedSourceLines());
  };

  readonly onApiTraceFunctionActivated = (apiIndex: number): void => {
    const call = this.m_lastResult.apiCalls[apiIndex];
    if (!call?.userFunctionCall) return;
    const name = this.functions.tabForCall(call);
    if (!name) {
      this.statusBar().showMessage('Function tab not found.', 2600);

      return;
    }
    this.selectFunction(name);
    this.m_editor.setFocus();
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
    if (parameters.size || this.m_viewport.hasApiFocus()) this.m_apiTrace.selectDebugItems(parameters);
    else this.selectRuntimeDebugVariables(names);
  };

  readonly onViewportMeshSelection = (apiIndex: number, sourceLine: number): void => {
    if (this.importedObj || apiIndex < 0) return;
    this.m_apiTrace.selectMeshApiCall(apiIndex);
    this.navigateToSource(sourceLine, new Set([sourceLine]));
  };

  readonly onViewportPointCreation = (point: Vec3): void => {
    if (this.importedObj) return;
    this.insertPointFromViewport(point);
  };

  navigateToSource(line: number, lines: ReadonlySet<number>): void {
    const previewProgram = this.session.program;
    if (line > this.executionFeedback.source.split('\n').length && previewProgram) {
      const location = previewProgram.locations.findLast((entry) => line >= entry.start && line <= entry.end);
      if (location) {
        const localLine = line - location.start + location.localStart;
        const localLines = new Set(
          [...lines]
            .filter((value) => value >= location.start && value <= location.end)
            .map((value) => value - location.start + location.localStart),
        );
        if (location.name !== this.functions.active) this.selectFunction(location.name);
        line = localLine;
        lines = localLines;
      }
    }
    if (line < 1 || line > this.m_editor.blockCount()) return;
    const navigation = this.m_navigatingToTrace;
    this.m_navigatingToTrace = true;
    try {
      this.m_browsingTrace = true;
      this.m_previewTimer.stop();
      this.m_editor.setTextCursorToLine(line);
      this.m_editor.centerCursor();
      this.m_editor.setTraceSourceLines(lines, line);
      this.statusBar().showMessage(`Source line ${line} - keeping preview at line ${this.m_currentPreviewLine}`, 3000);
    } finally {
      this.m_navigatingToTrace = navigation;
    }
  }

  selectRuntimeDebugVariables(selection: ReadonlySet<string>): void {
    // clearApiFocus() re-entrantly resets the viewport selection, which may be the Set passed in.
    const names = new Set(selection);
    if (this.m_apiTrace.selectedApiCall() >= 0) this.m_apiTrace.clearApiFocus();
    this.m_viewport.setSelectedVariables(names);
    const lines = new Set<number>();
    let primary = '';
    let primaryLine = 0;
    for (const variable of this.m_lastResult.variables) {
      const name = variable.name;
      if (!names.has(name)) continue;
      if (variable.lastChangedLine > 0) lines.add(variable.lastChangedLine);
      primary = name;
      primaryLine = variable.lastChangedLine;
    }
    if (primary !== '') this.m_variables.selectVariable(primary);
    if (primaryLine > 0) this.navigateToSource(primaryLine, lines);
    else this.m_editor.setTraceSourceLines(lines);
  }

  createDockPanels(): void {
    this.#raisedDock = 'ParametersDock';
  }

  // Sub-Parameter stays raised while its function tab loses its inputs, and shows again when they return.
  raisedDock(): DockName {
    return this.#raisedDock === 'SubParametersDock' && !this.canEditSubParameters ? 'ParametersDock' : this.#raisedDock;
  }

  readonly raiseDock = (name: DockName): void => {
    if (name === 'SubParametersDock' && !this.canEditSubParameters) return;
    if (this.#raisedDock === name) return;
    this.#raisedDock = name;
    this.changed();
  };

  createActions(): void {
    const actions = createWorkspaceActions({
      exit: () => window.close(),
      runPreview: () => {
        if (this.previewMode === 'build') this.buildPreview();
        else this.runPreview();
      },
      setShowGeometry: (show) => this.m_viewport.setShowGeometry(show),
      setGeometryWireframe: (wireframe) => this.m_viewport.setGeometryWireframe(wireframe),
      fitScene: () => this.m_viewport.fitScene(),
      setShowPoints: (show) => this.m_viewport.setShowPoints(show),
      setShowVectors: (show) => this.m_viewport.setShowVectors(show),
      setShowLabels: (show) => this.m_viewport.setShowLabels(show),
      fitDebugOverlay: () => this.m_viewport.fitDebugOverlay(),
      setSelectedDebugItemsVisible: (visible) => this.#setSelectedDebugItemsVisible(visible),
    });
    this.toolbarItems = actions.toolbarItems;
    this.shortcutActions = actions.shortcutActions;
    this.#showGeometryAction = actions.showGeometry;
  }

  #setSelectedDebugItemsVisible(visible: boolean): void {
    let names = this.m_apiTrace.selectedDebugItems();
    if (names.size === 0) names = this.m_viewport.selectedDebugItems();
    if (names.size === 0) {
      this.statusBar().showMessage(
        visible
          ? 'Select a point/vector parameter in API Trace or Variables first'
          : 'Select a point/vector parameter in API Trace, Variables, or the viewport first',
        2500,
      );

      return;
    }
    for (const name of names) this.m_viewport.setDebugItemVisible(name, visible);
    this.statusBar().showMessage(`${visible ? 'Shown' : 'Hidden'} ${names.size} selected debug item(s)`, 1800);
  }

  readonly exitPreviewFocus = (): void => {
    if (this.importedObj) {
      this.m_viewport.setSelectedApiCall(-1);
      this.m_viewport.clearApiFocus();

      return;
    }
    this.m_links.exitPreview();
    this.m_apiTrace.clearApiFocus();
  };

  schedulePreview(): void {
    if (this.previewMode === 'debug') this.m_previewTimer.start();
  }

  runPreview(): void {
    if (this.previewMode === 'build') return;
    const line = this.m_browsingTrace ? this.m_currentPreviewLine : this.m_editor.currentLine();

    this.updatePreview(line);
  }

  private updatePreview(
    line: number,
    source = this.m_editor.toPlainText(),
    program?: ReturnType<FunctionWorkspace['program']>,
    parameters?: ReadonlyMap<string, string>,
  ): void {
    this.m_previewTimer.stop();
    try {
      program ??= this.functions.program(source);
    } catch (error) {
      this.functions.reportError(what(error));
      this.changed();

      return;
    }
    this.functions.clearError();
    const parameterDefinitions = this.session.discoverParameters(program, (name) => this.functions.isDeleted(name));
    this.m_parameters.setDefinitions(parameterDefinitions);

    const outcome = this.session.execute(program, source, line, parameters ?? this.m_parameters.overrides());
    if ('error' in outcome) {
      this.changed();
      this.statusBar().showMessage(`Line ${line}: preview stopped: ${outcome.error}`, 4000, 'error');

      return;
    }
    const { result } = outcome;
    this.inspectorCounts = {
      VariablesDock: result.variables.length,
      ParametersDock: parameterDefinitions.reduce((count, definition) => count + parameterSlotCount(definition), 0),
      ApiTraceDock: result.apiCalls.length,
    };
    this.changed();

    this.m_variables.setRuntimeResult(result, line);
    this.m_apiTrace.setRuntimeResult(result);
    this.m_parameters.updateRuntimeResult(result);

    if (!this.importedObj) {
      this.m_viewport.setGeometryScene(this.m_geometryScene);
      this.m_viewport.setRuntimeResult(result);
    }
    this.m_links.updateRuntimeResult(result);
    this.applyApiFocus(this.m_apiTrace.selectedApiCall());

    const selected = this.m_variables.selectedVariable();
    if (this.m_apiTrace.selectedApiCall() >= 0)
      this.m_viewport.setSelectedVariables(this.m_apiTrace.selectedDebugItems());
    else if (selected !== '') this.m_viewport.setSelectedVariable(selected);

    if (result.diagnostics.length === 0) {
      const mode = this.previewMode === 'build' ? 'Build' : `Line ${line}`;
      let message = `${mode} | ${this.m_geometryScene.meshes.length} live mesh(es) | ${result.apiCalls.length} API call(s)`;
      if (this.m_geometryScene.warnings.length)
        message += ` | geometry warning: ${this.m_geometryScene.warnings[this.m_geometryScene.warnings.length - 1]}`;
      this.statusBar().showMessage(message, 2600, this.m_geometryScene.warnings.length ? 'warning' : 'info');
    } else {
      const d = result.diagnostics[result.diagnostics.length - 1];
      this.statusBar().showMessage(`Line ${d.line}: ${d.message}`, 4000, 'error');
    }
  }

  applyApiFocus(apiIndex: number): void {
    if (this.importedObj) return;
    this.m_viewport.setSelectedApiCall(apiIndex, apiIndex >= 0 && this.m_apiTrace.meshApiCall() === apiIndex);
    if (apiIndex < 0 || apiIndex >= this.m_lastResult.apiCalls.length) {
      this.m_viewport.clearApiFocus();
      this.statusBar().showMessage('API focus cleared - full preview restored', 1800);

      return;
    }

    const focusedApiIndices = new Set<number>();
    const selectedCalls = this.m_apiTrace.selectedApiCalls();
    for (const index of selectedCalls) focusedApiIndices.add(index);
    const debugApiIndices = new Set(selectedCalls);
    const calls = this.m_lastResult.apiCalls;
    for (let i = 0; i < calls.length; ++i) {
      let parent = calls[i].parentApiIndex;
      while (parent >= 0) {
        if (selectedCalls.has(parent)) {
          focusedApiIndices.add(i);
          // Main shows a sub-function's input points, not its internal API snapshots.
          if (this.functions.active || !calls[parent].userFunctionCall) debugApiIndices.add(i);
        }
        if (parent >= calls.length) break;
        parent = calls[parent].parentApiIndex;
      }
    }
    this.m_viewport.setApiFocusIndices(focusedApiIndices, debugApiIndices);

    const call = calls[apiIndex];
    const snapshotDebugCount = resolveDebugPointSnapshots(call).length + resolveDebugVectorAnchors(call).length;
    this.statusBar().showMessage(
      `API #${apiIndex + 1} ${call.name} | ${snapshotDebugCount} point/vector input(s), ${focusedApiIndices.size} call(s) in focus`,
      3000,
    );
  }

  insertPointFromViewport(point: Vec3): void {
    const name = this.nextPreviewPointName();
    const declaration = pointDeclaration(name, point);

    const newLine = this.m_editor.cursorBlockText().trim() === '' ? '' : '\n';
    this.m_editor.insertAtCursorBlockEnd(`${newLine}${declaration}\n`);
    this.m_editor.setFocus();

    this.statusBar().showMessage(`Inserted ${name} from viewport: ${declaration}`, 3000);
    this.schedulePreview();
  }

  nextPreviewPointName(): string {
    return unusedPreviewPointName(this.m_editor.toPlainText());
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (closestTarget(event.target, floatingWindowSelector)) return;
    if (event.key === 'Escape') {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      this.exitPreviewFocus();

      return;
    }
    const textInput = !!closestTarget(event.target, textInputSelector);
    for (const action of this.shortcutActions) {
      const shortcut = action.shortcut();
      if (!shortcut || !matchesKeySequence(shortcut, event)) continue;
      if (!shortcut.control && textInput) return;
      event.preventDefault();
      action.trigger();

      return;
    }
  }
}

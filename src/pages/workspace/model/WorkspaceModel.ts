import { parameterSlotCount } from '@/entities/parameter';
import { FunctionWorkspace } from '@/entities/source-function';
import { LinkPanelModel } from '@/features/edit-connector';
import { ParameterPanelModel } from '@/features/edit-parameters';
import { FunctionTabsController } from '@/features/manage-functions';
import { canExportModel, exportedObjText, type ImportedModel } from '@/features/model-files';
import { PreviewSession, type PreviewMode } from '@/features/run-preview';
import type { DockName, InspectorCounts } from '@/pages/workspace/model/types';
import { SelectionSync } from '@/pages/workspace/model/selectionSync';
import { StatusBarModel } from '@/pages/workspace/model/StatusBarModel';
import type { Action } from '@/shared/lib/action';
import { Observable } from '@/shared/lib/observable';
import { closestTarget, floatingWindowSelector, matchesKeySequence, textInputSelector } from '@/shared/lib/qt';
import { SingleShotTimer } from '@/shared/lib/SingleShotTimer';
import { ApiTracePanelModel } from '@/widgets/api-trace-panel';
import type { CodeEditorHandle } from '@/widgets/code-editor';
import { VariablePanelModel } from '@/widgets/variable-panel';
import { pointDeclaration, unusedPreviewPointName, type Vec3, type Viewport3DHandle } from '@/widgets/viewport';
import { createWorkspaceActions, type ActionListItem } from '@/widgets/workspace-header';
import type { ConnectorPreview, PreviewGeometryScene } from '@engine/geometry';
import { emptyRuntimeResult, what } from '@engine/runtime';

// The workspace page: owns the panel models and the preview session, and turns what happens in
// one panel into updates of the others. The editor and viewport wrap DOM objects, so they are
// bound when their components mount.
export class WorkspaceModel extends Observable {
  readonly variables = new VariablePanelModel();
  readonly parameters = new ParameterPanelModel();
  readonly apiTrace = new ApiTracePanelModel();
  readonly links = new LinkPanelModel();
  readonly session = new PreviewSession();
  readonly functions = new FunctionWorkspace();
  readonly functionTabs = new FunctionTabsController(
    this.functions,
    () => this.editor,
    () => this.parameters,
  );
  readonly previewTimer = new SingleShotTimer(220, () => this.runPreview());
  readonly selection = new SelectionSync(this);

  #editor: CodeEditorHandle | null = null;
  #viewport: Viewport3DHandle | null = null;
  #switchingEditor = false;
  readonly #statusBar = new StatusBarModel();
  #raisedDock: DockName = 'ParametersDock';
  #connectorPreviews: readonly ConnectorPreview[] = [];
  #selectedConnectorId = -1;
  #showGeometryAction: Action | null = null;

  importedObj: ImportedModel | null = null;
  inspectorCounts: InspectorCounts = { VariablesDock: 0, ParametersDock: 0, ApiTraceDock: 0 };
  toolbarItems: ActionListItem[] = [];
  shortcutActions: Action[] = [];

  readonly bindEditor = (handle: CodeEditorHandle | null): void => {
    this.#editor = handle;
  };

  readonly bindViewport = (handle: Viewport3DHandle | null): void => {
    this.#viewport = handle;
  };

  get editor(): CodeEditorHandle {
    if (!this.#editor) throw new Error('The code editor is not mounted.');

    return this.#editor;
  }

  get viewport(): Viewport3DHandle {
    if (!this.#viewport) throw new Error('The 3D viewport is not mounted.');

    return this.#viewport;
  }

  constructor() {
    super();
    this.#connectPanels();
    this.#connectFunctionTabs();
    this.#createActions();
  }

  #connectPanels(): void {
    const { selection } = this;
    this.variables.selectionChanged.connect(selection.onVariableSelectionChanged);
    this.parameters.valuesChanged.connect(this.onParametersChanged);
    this.parameters.setAvailability((parameters) => this.session.activeParameterKeys(parameters));
    this.apiTrace.selectionChanged.connect(selection.onApiTraceSelectionChanged);
    this.apiTrace.sourceActivated.connect(selection.onApiTraceSourceActivated);
    this.apiTrace.functionActivated.connect(selection.onApiTraceFunctionActivated);
    this.apiTrace.historySourceActivated.connect(selection.onApiTraceHistorySourceActivated);
    this.links.setExpressionEvaluator((expression) => this.session.runtime.evaluateNumericExpression(expression));
    this.links.previewChanged.connect(this.onLinkPreviewChanged);
  }

  statusBar(): StatusBarModel {
    return this.#statusBar;
  }

  start(): void {
    this.editor.clear();
    this.parameters.setPlaceholderData();
    this.apiTrace.setPlaceholderData();
    this.runPreview();
    this.statusBar().showMessage('Geometry Preview ready');
  }

  dispose(): void {
    this.previewTimer.stop();
  }

  get canExportObj(): boolean {
    return canExportModel(this.importedObj, this.session.scene, this.#connectorPreviews);
  }

  replacePreviewWithObj(scene: PreviewGeometryScene, name: string): void {
    this.importedObj = { scene, name };
    this.#showGeometryAction?.setChecked(true);
    this.viewport.clearApiFocus();
    this.viewport.setRuntimeResult(emptyRuntimeResult());
    this.viewport.setConnectorPreviews([], -1);
    this.viewport.setGeometryScene(scene);
    this.viewport.fitScene();
    this.changed();
  }

  readonly returnToCodePreview = (): void => {
    this.importedObj = null;
    if (this.session.mode === 'debug') this.runPreview();
    else {
      this.viewport.setGeometryScene(this.session.scene);
      this.viewport.setRuntimeResult(this.session.lastResult);
      this.selection.applyApiFocus(this.apiTrace.selectedApiCall());
    }
    this.viewport.setConnectorPreviews(this.#connectorPreviews, this.#selectedConnectorId);
    this.viewport.fitScene();
    this.changed();
  };

  exportObj(): string {
    if (!this.importedObj) this.runPreview();

    return exportedObjText(this.importedObj, this.session.scene, this.#connectorPreviews);
  }

  readonly buildPreview = (): void => {
    this.#activatePreviewMode('build');
    this.parameters.commitEditor();
    const source = this.editor.toPlainText();
    let program: ReturnType<FunctionWorkspace['program']>;
    try {
      program = this.functions.program(source);
    } catch (error) {
      this.functions.reportError(what(error));
      this.changed();

      return;
    }
    this.session.beginBuild();
    this.#updatePreview(source.split('\n').length, source, program);
    this.session.recordBuild(this.functions.active, source, program, this.parameters.overrides());
    this.changed();
  };

  readonly debugPreview = (): void => {
    if (this.session.debugBlocked) return;
    this.#activatePreviewMode('debug');
    this.runPreview();
  };

  #activatePreviewMode(mode: PreviewMode): void {
    this.previewTimer.stop();
    this.session.setMode(mode);
    this.importedObj = null;
    this.selection.browsingTrace = false;
    this.apiTrace.clearApiFocus();
    this.editor.setTraceSourceLines(new Set());
    this.changed();
  }

  readonly onEditorTextChanged = (): void => {
    if (this.#switchingEditor) return;
    this.functions.edit(this.editor.toPlainText());
    this.editor.setTraceSourceLines(new Set());
    const text = this.editor.toPlainText();
    this.session.markEdited(text, () => this.functions.program(text, false).source);
    this.changed();
    this.schedulePreview();
  };

  readonly onEditorCursorPositionChanged = (): void => {
    if (this.#switchingEditor) return;
    if (this.selection.navigating) return;
    this.editor.setTraceSourceLines(new Set());
    this.selection.browsingTrace = false;
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
    tabs.editorSwitched.connect(() => this.#showFunctionEditor());
    tabs.stateChanged.connect(() => this.changed());
    tabs.draftCancelled.connect((name) => this.session.forgetBuild(name));
    tabs.functionDeleted.connect((name) => {
      this.previewTimer.stop();
      this.session.forgetFunction(name);
    });
    tabs.inputsChanged.connect(() => this.onParametersChanged());
    tabs.applyRequested.connect(() => this.applyParameters());
    tabs.statusMessage.connect((text) => this.statusBar().showMessage(text, 2600));
  }

  #showFunctionEditor(): void {
    this.previewTimer.stop();
    this.#switchingEditor = true;
    try {
      this.editor.setSource(this.functions.source());
      this.editor.setTextCursorToLine(this.editor.blockCount());
    } finally {
      this.#switchingEditor = false;
    }
    this.importedObj = null;
    this.selection.browsingTrace = false;
    this.apiTrace.clearApiFocus();
    this.editor.setTraceSourceLines(new Set());
    this.functions.selectInputTab(this.functions.active);
    this.session.clear(this.functions.source());
    this.viewport.setGeometryScene(this.session.scene);
    this.viewport.setRuntimeResult(this.session.lastResult);
    this.variables.setRuntimeResult(this.session.lastResult, 1);
    this.apiTrace.setRuntimeResult(this.session.lastResult);
    const currentProgram = this.functions.program(this.functions.source(), false);
    const built = this.session.restoreTab(this.functions.active, this.functions.source(), currentProgram);
    if (this.session.mode === 'build') {
      if (built) {
        this.session.showBuild(built);
        this.#updatePreview(built.source.split('\n').length, built.source, built.program, built.parameters);
        this.session.markDriftSince(built, this.parameters.overrides(), currentProgram);
      } else this.buildPreview();
    } else this.runPreview();
    const main = this.functions.inline[0];
    this.parameters.selectTab(
      this.functions.active || (main && currentProgram.options.functionScopes?.get(main.signature)) || main?.name || '',
    );
    if (!this.canEditSubParameters && this.#raisedDock === 'SubParametersDock') this.#raisedDock = 'ParametersDock';
    this.changed();
  }

  readonly onLinkPreviewChanged = (
    previews: readonly ConnectorPreview[],
    selectedId: number,
    tested: boolean,
  ): void => {
    this.#connectorPreviews = previews;
    this.#selectedConnectorId = selectedId;
    this.changed();
    if (this.importedObj) return;
    if (tested) this.apiTrace.clearApiFocus();
    this.viewport.setConnectorPreviews(previews, selectedId);
    if (tested) this.viewport.fitScene();
  };

  readonly onViewportConnectorSelection = (id: number): void => {
    this.links.selectConnector(id);
    this.raiseDock('LinkDock');
  };

  readonly onViewportPointCreation = (point: Vec3): void => {
    if (this.importedObj) return;
    this.#insertPointFromViewport(point);
  };

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

  #createActions(): void {
    const actions = createWorkspaceActions({
      exit: () => window.close(),
      runPreview: () => {
        if (this.session.mode === 'build') this.buildPreview();
        else this.runPreview();
      },
      setShowGeometry: (show) => this.viewport.setShowGeometry(show),
      setGeometryWireframe: (wireframe) => this.viewport.setGeometryWireframe(wireframe),
      fitScene: () => this.viewport.fitScene(),
      setShowPoints: (show) => this.viewport.setShowPoints(show),
      setShowVectors: (show) => this.viewport.setShowVectors(show),
      setShowLabels: (show) => this.viewport.setShowLabels(show),
      fitDebugOverlay: () => this.viewport.fitDebugOverlay(),
      setSelectedDebugItemsVisible: (visible) => this.#setSelectedDebugItemsVisible(visible),
    });
    this.toolbarItems = actions.toolbarItems;
    this.shortcutActions = actions.shortcutActions;
    this.#showGeometryAction = actions.showGeometry;
  }

  #setSelectedDebugItemsVisible(visible: boolean): void {
    const names = this.selection.selectedDebugItems();
    if (names.size === 0) {
      this.statusBar().showMessage(
        visible
          ? 'Select a point/vector parameter in API Trace or Variables first'
          : 'Select a point/vector parameter in API Trace, Variables, or the viewport first',
        2500,
      );

      return;
    }
    for (const name of names) this.viewport.setDebugItemVisible(name, visible);
    this.statusBar().showMessage(`${visible ? 'Shown' : 'Hidden'} ${names.size} selected debug item(s)`, 1800);
  }

  readonly exitPreviewFocus = (): void => {
    if (this.importedObj) {
      this.viewport.setSelectedApiCall(-1);
      this.viewport.clearApiFocus();

      return;
    }
    this.links.exitPreview();
    this.apiTrace.clearApiFocus();
  };

  schedulePreview(): void {
    if (this.session.mode === 'debug') this.previewTimer.start();
  }

  runPreview(): void {
    if (this.session.mode === 'build') return;
    const line = this.selection.browsingTrace ? this.session.currentLine : this.editor.currentLine();

    this.#updatePreview(line);
  }

  #updatePreview(
    line: number,
    source = this.editor.toPlainText(),
    program?: ReturnType<FunctionWorkspace['program']>,
    parameters?: ReadonlyMap<string, string>,
  ): void {
    this.previewTimer.stop();
    try {
      program ??= this.functions.program(source);
    } catch (error) {
      this.functions.reportError(what(error));
      this.changed();

      return;
    }
    this.functions.clearError();
    const parameterDefinitions = this.session.discoverParameters(program, (name) => this.functions.isDeleted(name));
    this.parameters.setDefinitions(parameterDefinitions);

    const outcome = this.session.execute(program, source, line, parameters ?? this.parameters.overrides());
    if ('error' in outcome) {
      this.changed();
      this.statusBar().showMessage(`Line ${line}: preview stopped: ${outcome.error}`, 4000, 'error');

      return;
    }
    const { result } = outcome;
    const scene = this.session.scene;
    this.inspectorCounts = {
      VariablesDock: result.variables.length,
      ParametersDock: parameterDefinitions.reduce((count, definition) => count + parameterSlotCount(definition), 0),
      ApiTraceDock: result.apiCalls.length,
    };
    this.changed();

    this.variables.setRuntimeResult(result, line);
    this.apiTrace.setRuntimeResult(result);
    this.parameters.updateRuntimeResult(result);

    if (!this.importedObj) {
      this.viewport.setGeometryScene(scene);
      this.viewport.setRuntimeResult(result);
    }
    this.links.updateRuntimeResult(result);
    this.selection.restoreAfterRun();

    if (result.diagnostics.length === 0) {
      const mode = this.session.mode === 'build' ? 'Build' : `Line ${line}`;
      let message = `${mode} | ${scene.meshes.length} live mesh(es) | ${result.apiCalls.length} API call(s)`;
      if (scene.warnings.length) message += ` | geometry warning: ${scene.warnings[scene.warnings.length - 1]}`;
      this.statusBar().showMessage(message, 2600, scene.warnings.length ? 'warning' : 'info');
    } else {
      const d = result.diagnostics[result.diagnostics.length - 1];
      this.statusBar().showMessage(`Line ${d.line}: ${d.message}`, 4000, 'error');
    }
  }

  #insertPointFromViewport(point: Vec3): void {
    const name = unusedPreviewPointName(this.editor.toPlainText());
    const declaration = pointDeclaration(name, point);

    const newLine = this.editor.cursorBlockText().trim() === '' ? '' : '\n';
    this.editor.insertAtCursorBlockEnd(`${newLine}${declaration}\n`);
    this.editor.setFocus();

    this.statusBar().showMessage(`Inserted ${name} from viewport: ${declaration}`, 3000);
    this.schedulePreview();
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

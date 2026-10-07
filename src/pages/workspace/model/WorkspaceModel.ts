import { parameterSlotCount } from '@/entities/parameter';
import { FunctionWorkspace } from '@/entities/source-function';
import { LinkPanelModel } from '@/features/edit-connector';
import { ParameterPanelModel } from '@/features/edit-parameters';
import { ElementLibraryModel, evaluateLibraryExpression, type LibrarySample } from '@/features/element-library';
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
import { emptyRuntimeResult, GeometryRuntime, what } from '@engine/runtime';

// The workspace page: owns the panel models and the preview session, and turns what happens in
// one panel into updates of the others. The editor and viewport wrap DOM objects, so they are
// bound when their components mount.
export class WorkspaceModel extends Observable {
  readonly library = new ElementLibraryModel();
  #libraryValues: ReadonlyMap<string, string> | null = null;
  readonly variables = new VariablePanelModel();
  readonly parameters = new ParameterPanelModel();
  readonly mainApiTrace = new ApiTracePanelModel();
  readonly subApiTrace = new ApiTracePanelModel();

  get apiTrace(): ApiTracePanelModel {
    return this.functions.active ? this.subApiTrace : this.mainApiTrace;
  }

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
    this.session.parameterAvailabilityChanged.connect(() => this.parameters.refreshAvailability());
    for (const trace of [this.mainApiTrace, this.subApiTrace]) {
      trace.selectionChanged.connect(selection.onApiTraceSelectionChanged);
      trace.sourceActivated.connect(selection.onApiTraceSourceActivated);
      trace.functionActivated.connect(selection.onApiTraceFunctionActivated);
      trace.historySourceActivated.connect(selection.onApiTraceHistorySourceActivated);
    }
    this.links.setExpressionEvaluator((expression) => {
      if (!this.#libraryValues) return this.session.runtime.evaluateNumericExpression(expression);
      const values = new Map(this.#libraryValues);
      for (const [key, value] of this.parameters.overrides()) values.set(key.split('::').at(-1)!, value);

      return evaluateLibraryExpression(expression, values);
    });
    this.links.previewChanged.connect(this.onLinkPreviewChanged);
    this.library.openRequested.connect((sample, replaceSource) => this.#loadLibrarySample(sample, replaceSource));
  }

  #loadLibrarySample(sample: LibrarySample, replaceSource: boolean): void {
    this.previewTimer.stop();
    this.session.setMode('build');
    this.importedObj = null;
    if (replaceSource) {
      this.functions.replaceFiles(sample.files);
      this.#setEditorSource(1);
    } else {
      this.functions.edit(this.editor.toPlainText());
      this.functions.select('');
      this.#setEditorSource(1);
    }
    const program = this.functions.program();
    const definitions = this.session.discoverParameters(program, () => false);
    this.parameters.loadValues(definitions, sample.values);
    this.#libraryValues = sample.values;
    this.links.loadDefinitions(sample.connectors);
    this.buildPreview();
    this.viewport.fitScene();
    this.#raisedDock = 'ParametersDock';
    this.changed();
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
    this.session.dispose();
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
    this.functions.edit(source);
    if (this.functions.active) this.#refreshFunctionCalls(this.parameters.overrides());
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
    this.session.recordBuild(this.functions.cacheKey, source, program, this.parameters.overrides());
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

  readonly addSourceFiles = (name: string, header: boolean): boolean => this.functionTabs.add(name, header);
  readonly clearFunctionError = (): void => this.functionTabs.clearError();
  readonly selectSourceFile = (name: string): void => this.functionTabs.selectFile(name);
  readonly deleteSourceFile = (): void => this.functionTabs.remove();
  readonly selectFunction = (name: string, apiIndex?: number): void => {
    const result = this.session.lastResult;
    const occurrence =
      apiIndex === undefined
        ? undefined
        : result.apiCalls.slice(0, apiIndex + 1).filter((call) => this.functions.tabForCall(call) === name).length - 1;
    this.functions.edit(this.editor.toPlainText());
    this.parameters.commitEditor();
    if (name) {
      const built = this.session.mode === 'build' ? this.session.built('') : undefined;
      this.#refreshFunctionCalls(built?.parameters ?? this.parameters.overrides(), built?.program);
    }
    this.functions.select(name);
    if (occurrence !== undefined) this.functions.selectOccurrence(occurrence);
    this.#raisedDock = name ? 'SubApiTraceDock' : 'ApiTraceDock';
    this.#showFunctionEditor();
  };

  #refreshFunctionCalls(
    parameters: ReadonlyMap<string, string>,
    program = this.functions.program(undefined, false, true),
  ): void {
    const runtime = new GeometryRuntime();
    runtime.setParameters(parameters);
    this.functions.acceptCalls(
      runtime.executeUpToLine(program.source, program.source.split('\n').length, true, program.options),
    );
  }

  readonly selectFunctionOccurrence = (index: number): void => {
    this.functions.selectOccurrence(index);
    this.#showFunctionEditor();
  };

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
  readonly resetFunctionInputs = (name: string): void => this.functionTabs.resetInputs(name);
  readonly selectFunctionInputs = (name: string): void => this.functionTabs.selectInputs(name);
  readonly applyFunctionInputs = (name: string): void => {
    if (this.functions.active !== name) this.selectFunction(name);
    this.buildPreview();
    this.#raisedDock = 'SubParametersDock';
  };

  #connectFunctionTabs(): void {
    const tabs = this.functionTabs;
    tabs.editorSwitched.connect(() => this.#showFunctionEditor());
    tabs.stateChanged.connect(() => this.changed());
    tabs.inputsChanged.connect(() => this.onParametersChanged());
    tabs.removed.connect((names) => {
      for (const name of names) this.session.forgetFunction(name);
    });
  }

  readonly openSourceFile = (file: string): void => {
    this.functions.edit(this.editor.toPlainText());
    this.functions.openFile(file);
    this.#setEditorSource(1);
    this.changed();
  };

  #setEditorSource(line: number): void {
    this.#switchingEditor = true;
    try {
      this.editor.setSource(this.functions.source());
      this.editor.setTextCursorToLine(line);
      this.editor.centerCursor();
    } finally {
      this.#switchingEditor = false;
    }
  }

  #showFunctionEditor(): void {
    this.previewTimer.stop();
    const fn = this.functions.functions.find((fn) => fn.name === this.functions.active);
    this.#setEditorSource(fn?.line ?? 1);
    this.importedObj = null;
    this.selection.browsingTrace = false;
    this.apiTrace.clearApiFocus();
    this.editor.setTraceSourceLines(new Set());
    this.session.clear(this.functions.source());
    if (this.session.mode === 'build') {
      const source = this.editor.toPlainText();
      const program = this.functions.program(source, false);
      const built = this.session.restoreTab(this.functions.cacheKey, source, program);
      if (built) {
        this.#updatePreview(
          source.split('\n').length,
          source,
          { ...built.program, editorFile: this.functions.activeFile },
          built.parameters,
        );
        this.session.showBuild(built);
        this.session.markDriftSince(built, this.parameters.overrides(), program);
      } else {
        const main = this.session.built('');
        const parameters = main?.parameters ?? this.parameters.overrides();
        const compiled =
          main && program.options.debugCall
            ? {
                ...main.program,
                editorFile: program.editorFile,
                options: {
                  ...main.program.options,
                  debugCall: program.options.debugCall,
                  arguments: program.options.arguments,
                },
              }
            : program;
        this.#updatePreview(source.split('\n').length, source, compiled, parameters);
        const location = compiled.locations.find((entry) => entry.name === compiled.editorFile);
        const builtSource = location
          ? compiled.source
              .split('\n')
              .slice(location.start - 1, location.end)
              .join('\n')
          : source;
        this.session.recordBuild(this.functions.cacheKey, builtSource, compiled, parameters);
        this.session.restoreTab(this.functions.cacheKey, source, program);
        this.session.markDriftSince(this.session.built(this.functions.cacheKey)!, this.parameters.overrides(), program);
      }
    } else {
      this.#updatePreview(fn ? fn.line + fn.code.split('\n').length - 1 : this.editor.currentLine());
      this.selection.browsingTrace = !!fn;
    }
    this.parameters.selectTab(this.functions.active || this.functions.inline[0]?.name || '');
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
    if (name === 'ApiTraceDock' && this.functions.active) this.selectFunction('');
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
    const parameterDefinitions = this.session.discoverParameters(program, () => false);
    this.parameters.setDefinitions(parameterDefinitions);

    const outcome = this.session.execute(program, source, line, parameters ?? this.parameters.overrides());
    if ('error' in outcome) {
      this.changed();
      this.statusBar().showMessage(`Line ${line}: preview stopped: ${outcome.error}`, 4000, 'error');

      return;
    }
    const { result } = outcome;
    if (!this.functions.active && this.session.mode === 'build') this.functions.acceptCalls(result);
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

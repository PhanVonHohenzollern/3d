import { FunctionWorkspace } from '@/entities/source-function';
import { LinkPanelModel } from '@/features/edit-connector';
import { ParameterPanelModel } from '@/features/edit-parameters';
import {
  ElementLibraryModel,
  evaluateLibraryExpression,
  resolvePipeConnections,
  pipeConnectionParameters,
  connectorMeshConnections,
  inspectExecutedGetVals,
  resolvedRuntimeParameters,
  type LibrarySample,
  type LibraryDefaults,
  type LibraryDefaultState,
} from '@/features/element-library';
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
import { buildConnectionGeometry, type ConnectorPreview, type PreviewGeometryScene } from '@engine/geometry';
import { emptyRuntimeResult, GeometryRuntime, what } from '@engine/runtime';

// The workspace page: owns the panel models and the preview session, and turns what happens in
// one panel into updates of the others. The editor and viewport wrap DOM objects, so they are
// bound when their components mount.
export class WorkspaceModel extends Observable {
  readonly library = new ElementLibraryModel();
  #libraryDefaults: LibraryDefaults | null = null;
  readonly variables = new VariablePanelModel();
  readonly parameters = new ParameterPanelModel();
  readonly mainApiTrace = new ApiTracePanelModel();
  readonly subApiTrace = new ApiTracePanelModel();

  get apiTrace(): ApiTracePanelModel {
    return this.functions.active ? this.subApiTrace : this.mainApiTrace;
  }

  readonly links = new LinkPanelModel();
  readonly session = new PreviewSession();
  readonly #libraryPreviewSession = new PreviewSession();
  #libraryPreviewReady = false;
  editorTab: 'code' | 'flm' = 'code';
  readonly functions = new FunctionWorkspace();
  readonly functionTabs = new FunctionTabsController(
    this.functions,
    () => this.editor,
    () => this.parameters,
  );
  readonly previewTimer = new SingleShotTimer(220, () => this.runPreview());
  // Coalesce parameter edits before repeating the full C++ execution and mesh build.
  readonly #parameterBuildTimer = new SingleShotTimer(220, () => this.buildPreview());
  readonly selection = new SelectionSync(this);

  #editor: CodeEditorHandle | null = null;
  #viewport: Viewport3DHandle | null = null;
  #switchingEditor = false;
  #buildingPreview = false;
  readonly #statusBar = new StatusBarModel();
  #raisedDock: DockName = 'ParametersDock';
  #connectorPreviews: readonly ConnectorPreview[] = [];
  #selectedConnectorId = -1;
  #showGeometryAction: Action | null = null;

  importedObj: ImportedModel | null = null;
  inspectorCounts: InspectorCounts = {
    VariablesDock: 0,
    ParametersDock: 0,
    ApiTraceDock: 0,
  };
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
    this.parameters.defaultsReset.connect(() => {
      if (this.#libraryDefaults) this.#applyLibraryDefaults(this.#libraryDefaults.reset());
    });
    this.parameters.setAvailability((parameters) => this.session.activeParameterKeys(parameters));
    this.session.parameterAvailabilityChanged.connect(() => this.parameters.refreshAvailability());
    for (const trace of [this.mainApiTrace, this.subApiTrace]) {
      trace.selectionChanged.connect((apiIndex) => {
        if (apiIndex >= 0) this.links.clearSelection();
        selection.onApiTraceSelectionChanged(apiIndex);
      });
      trace.sourceActivated.connect(selection.onApiTraceSourceActivated);
      trace.functionActivated.connect(selection.onApiTraceFunctionActivated);
      trace.historySourceActivated.connect(selection.onApiTraceHistorySourceActivated);
    }
    this.links.setExpressionEvaluator((expression) => {
      const committed = this.#libraryDefaults?.currentState;
      if (!committed) return this.session.runtime.evaluateNumericExpression(expression);

      // Connector coordinates must be evaluated against the committed JSON snapshot.
      return evaluateLibraryExpression(expression, committed.snapshot.resolvedValues);
    });
    this.links.previewChanged.connect(this.onLinkPreviewChanged);
    this.links.definitionsChanged.connect(() => {
      this.session.markParametersChanged();
      if (this.session.mode === 'build') this.buildPreview();
      else this.runPreview();
    });
    this.library.openRequested.connect((sample, replaceSource) => this.#loadLibrarySample(sample, replaceSource));
    this.library.previewRequested.connect((sample) => this.#previewLibrarySample(sample));
    this.library.previewInvalidated.connect(() => {
      this.#libraryPreviewReady = false;
      if (this.editorTab === 'flm') {
        this.viewport.setGeometryScene({ meshes: [], warnings: [] });
        this.viewport.setRuntimeResult(emptyRuntimeResult());
        this.viewport.setConnectorPreviews([], -1);
      }
    });
  }

  readonly selectEditorTab = (tab: 'code' | 'flm'): void => {
    if (tab === this.editorTab) return;
    this.editorTab = tab;
    if (tab === 'code') {
      this.viewport.clearSelection();
      this.viewport.setGeometryScene(this.importedObj?.scene ?? this.session.scene);
      this.viewport.setRuntimeResult(this.importedObj ? emptyRuntimeResult() : this.session.lastResult);
      this.viewport.setConnectorPreviews(this.#connectorPreviews, this.#selectedConnectorId);
      this.viewport.fitScene();
    } else if (this.library.canOpen) {
      // Recreate the draft when revisiting FLM, without changing editor files.
      this.library.preview();
    } else if (this.#libraryPreviewReady) {
      this.#showLibraryPreview();
    } else {
      this.viewport.setGeometryScene({ meshes: [], warnings: [] });
      this.viewport.setRuntimeResult(emptyRuntimeResult());
      this.viewport.setConnectorPreviews([], -1);
    }
    this.changed();
  };

  #showLibraryPreview(): void {
    this.viewport.clearSelection();
    this.viewport.setConnectorPreviews([], -1);
    this.viewport.setGeometryScene(this.#libraryPreviewSession.scene);
    this.viewport.setRuntimeResult(this.#libraryPreviewSession.lastResult);
    this.viewport.fitScene();
  }

  #previewLibrarySample(sample: LibrarySample): void {
    if (this.editorTab !== 'flm') return;
    this.previewTimer.stop();
    this.#parameterBuildTimer.stop();
    try {
      // A separate workspace/runtime ensures that browsing never changes
      // FunctionWorkspace, CodeMirror, Parameters or the last editor Build.
      const draft = new FunctionWorkspace();
      draft.replaceFiles(sample.files);
      const program = draft.program();
      const requests = this.#libraryPreviewSession.discoverParameters(program, () => false);
      const snapshot = sample.defaults?.currentState.snapshot;
      const inputs = resolvedRuntimeParameters(sample.values, requests, snapshot);
      const context = new Map(sample.values);
      const definitions = sample.connectors;
      for (const [name, value] of pipeConnectionParameters(resolvePipeConnections(definitions, context), definitions))
        inputs.set(name, value);
      this.#libraryPreviewSession.setMode('build');
      const outcome = this.#libraryPreviewSession.execute(
        program,
        draft.mainSource,
        draft.mainSource.split('\n').length,
        inputs,
        (result) => {
          for (const request of result.parameterRequests)
            if (!snapshot || (request.sourceFunction !== 'get_val' && !snapshot.resolvedValues.has(request.name)))
              context.set(request.name, request.currentValue);

          return buildConnectionGeometry(
            connectorMeshConnections(resolvePipeConnections(definitions, context)),
            (expression) => evaluateLibraryExpression(expression, context),
            inputs.has('getExtInsSize') ? Number(inputs.get('getExtInsSize')) : undefined,
          );
        },
      );
      if ('error' in outcome) throw new Error(outcome.error);
      if (outcome.result.diagnostics.length)
        throw new Error(outcome.result.diagnostics.map((item) => item.message).join('; '));
      const bindingIssues = snapshot
        ? inspectExecutedGetVals(outcome.result.parameterRequests, snapshot)
        : { missing: [], invalid: [] };
      if (bindingIssues.invalid.length)
        throw new Error(`Invalid numeric JSON get_val value(s): ${bindingIssues.invalid.join(', ')}`);
      // A shared C++ constructor may query values used by different cases.
      // The interpreter and mesh adapter already executed the selected case;
      // missing bindings alone must not erase a valid scene.
      this.#libraryPreviewReady = true;
      this.#showLibraryPreview();
      const meshCount = this.#libraryPreviewSession.scene.meshes.length;
      const warning = bindingIssues.missing.length
        ? ` · unbound shared get_val: ${bindingIssues.missing.join(', ')} (verify preview)`
        : '';
      this.statusBar().showMessage(
        `FLM preview · ${meshCount} mesh(es) · press OK to insert code${warning}`,
        warning ? 6000 : 3000,
        warning ? 'warning' : 'info',
      );
    } catch (error) {
      this.#libraryPreviewReady = false;
      this.viewport.setGeometryScene({ meshes: [], warnings: [] });
      this.viewport.setRuntimeResult(emptyRuntimeResult());
      this.statusBar().showMessage(`FLM preview: ${what(error)}`, 6000, 'error');
    }
  }

  #loadLibrarySample(sample: LibrarySample, replaceSource: boolean): void {
    this.editorTab = 'code';
    this.#parameterBuildTimer.stop();
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
    this.#libraryDefaults = sample.defaults ?? null;
    this.parameters.loadValues(
      definitions,
      sample.values,
      sample.values,
      this.#libraryDefaults?.selectors,
      this.#libraryDefaults?.hiddenParameters,
      this.#libraryDefaults?.parameterModes,
    );
    this.parameters.setValueOptions(this.#libraryDefaults?.options ?? new Map());
    this.#libraryDefaults?.remember(this.parameters.savedValues());
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
    this.#parameterBuildTimer.stop();
    this.previewTimer.stop();
    this.session.dispose();
    this.#libraryPreviewSession.dispose();
  }

  get canExportObj(): boolean {
    return canExportModel(this.importedObj, this.session.scene, this.#connectorPreviews);
  }

  replacePreviewWithObj(scene: PreviewGeometryScene, name: string): void {
    this.importedObj = { scene, name };
    this.#showGeometryAction?.setChecked(true);
    this.viewport.clearSelection();
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
    if (this.#buildingPreview) return;
    this.#parameterBuildTimer.stop();
    this.#buildingPreview = true;
    try {
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
      try {
        const requests = this.session.discoverParameters(program, () => false);
        const committed = this.#libraryDefaults?.currentState;
        const inputs = resolvedRuntimeParameters(this.parameters.overrides(), requests, committed?.snapshot);
        this.session.recordBuild(this.functions.cacheKey, source, program, inputs);
      } catch (error) {
        this.statusBar().showMessage(what(error), 6000, 'error');
      }
      this.changed();
    } finally {
      this.#buildingPreview = false;
    }
  };

  readonly debugPreview = (): void => {
    if (this.session.debugBlocked) return;
    this.#activatePreviewMode('debug');
    this.runPreview();
  };

  #activatePreviewMode(mode: PreviewMode): void {
    this.#parameterBuildTimer.stop();
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
    if (this.session.mode === 'build' && !this.importedObj) {
      this.selection.selectEditorLine(this.editor.currentLine());

      return;
    }
    this.schedulePreview();
  };

  readonly onParametersChanged = (): void => {
    try {
      const defaults = this.#libraryDefaults?.change(this.parameters.savedValues(), this.links.definitions());
      if (defaults) this.#applyLibraryDefaults(defaults);
    } catch (error) {
      // Reject the entire edit together. Leaving an invalid tech/dimension in
      // savedValues makes every later edit retry that rejected value and
      // freezes geometry even when the next parameter is valid.
      if (this.#libraryDefaults) this.#applyLibraryDefaults(this.#libraryDefaults.currentState);
      this.statusBar().showMessage(error instanceof Error ? error.message : String(error), 6000, 'error');
      this.changed();

      return;
    }
    this.session.markParametersChanged();
    this.changed();
    if (this.session.mode === 'build') this.#parameterBuildTimer.start();
    else this.schedulePreview();
  };

  #applyLibraryDefaults(defaults: LibraryDefaultState): void {
    const program = this.functions.program();
    const definitions = this.session.discoverParameters(program, () => false);
    const tab = this.parameters.activeTab;
    this.parameters.loadValues(
      definitions,
      defaults.values,
      defaults.parameters,
      this.#libraryDefaults?.selectors,
      this.#libraryDefaults?.hiddenParameters,
      this.#libraryDefaults?.parameterModes,
    );
    this.parameters.setValueOptions(defaults.options ?? new Map());
    this.parameters.selectTab(tab);
    this.library.syncDefaults(defaults);
    this.#libraryDefaults?.remember(this.parameters.savedValues());
    this.links.loadDefinitions(defaults.connectors);
  }

  readonly addSourceFiles = (name: string, header: boolean): boolean => this.functionTabs.add(name, header);
  readonly clearFunctionError = (): void => this.functionTabs.clearError();
  readonly selectSourceFile = (name: string): void => this.functionTabs.selectFile(name);
  readonly deleteSourceFile = (name?: string): void => this.functionTabs.remove(name);
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
    const committed = this.#libraryDefaults?.currentState;
    if (committed?.snapshot.status !== 'valid') return;
    const definitions = new GeometryRuntime().discoverParameters(program.source, program.options);
    let resolved: Map<string, string>;
    try {
      resolved = resolvedRuntimeParameters(parameters, definitions, committed?.snapshot);
    } catch (error) {
      this.statusBar().showMessage(what(error), 6000, 'error');

      return;
    }
    const runtime = new GeometryRuntime();
    runtime.setParameters(resolved);
    const result = runtime.executeUpToLine(program.source, program.source.split('\n').length, true, program.options);
    if (committed) {
      const issues = inspectExecutedGetVals(result.parameterRequests, committed.snapshot);
      if (issues.invalid.length) {
        this.statusBar().showMessage(
          `Invalid numeric JSON get_val value(s): ${issues.invalid.join(', ')}`,
          6000,
          'error',
        );

        return;
      }
      if (issues.missing.length)
        this.statusBar().showMessage(
          `Unbound shared get_val (code trace preserved): ${issues.missing.join(', ')}`,
          6000,
          'warning',
        );
    }
    this.functions.acceptCalls(result);
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
    this.#parameterBuildTimer.stop();
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
    if (this.editorTab === 'code') this.viewport.setConnectorPreviews(previews, selectedId);
    if (tested) this.viewport.fitScene();
  };

  readonly onViewportConnectorSelection = (id: number): void => {
    if (id < 0) {
      this.links.clearSelection();

      return;
    }
    this.apiTrace.clearApiFocus();
    this.viewport.setSelectedVariables(new Set());
    this.viewport.setSelectedApiCall(-1);
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
    this.links.clearSelection();
    this.mainApiTrace.clearApiFocus();
    this.subApiTrace.clearApiFocus();
    this.variables.selectVariable('');
    this.viewport.clearSelection();
    this.editor.setTraceSourceLines(new Set());
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

    const committed = this.#libraryDefaults?.currentState;
    if (committed && committed.snapshot.status !== 'valid') {
      this.statusBar().showMessage('Preview stopped: library parameters are not resolved.', 4000, 'error');

      return;
    }
    let inputs: Map<string, string>;
    try {
      inputs = resolvedRuntimeParameters(
        parameters ?? this.parameters.overrides(),
        parameterDefinitions,
        committed?.snapshot,
      );
    } catch (error) {
      this.statusBar().showMessage(what(error), 6000, 'error');

      return;
    }
    const context = new Map(this.parameters.contextValues());
    if (committed) {
      // Library parameters must never be overwritten by runtime-only overrides.
      for (const [name, value] of committed.snapshot.resolvedValues) context.set(name, value);
    } else {
      for (const [key, value] of inputs) context.set(key.split('::').at(-1)!, value);
    }
    const definitions = committed ? committed.connectors : this.links.definitions();
    for (const [key, value] of pipeConnectionParameters(resolvePipeConnections(definitions, context), definitions))
      inputs.set(key, value);
    const outcome = this.session.execute(program, source, line, inputs, (result) => {
      for (const request of result.parameterRequests)
        if (
          !committed ||
          (request.sourceFunction !== 'get_val' && !committed.snapshot.resolvedValues.has(request.name))
        )
          context.set(request.name, request.currentValue);

      // All connectors still feed the C++ runtime queries above. Only
      // flanged/threaded technologies generate additional Connector Mesh.
      return buildConnectionGeometry(
        connectorMeshConnections(resolvePipeConnections(definitions, context)),
        (expression) => evaluateLibraryExpression(expression, context),
        inputs.has('getExtInsSize') ? Number(inputs.get('getExtInsSize')) : undefined,
      );
    });
    if ('error' in outcome) {
      this.changed();
      this.statusBar().showMessage(`Line ${line}: preview stopped: ${outcome.error}`, 4000, 'error');

      return;
    }
    const { result } = outcome;
    // Only the selected branch executed. A queried C++ variable that is not
    // supplied by this entity's JSON may be irrelevant to emitted geometry.
    // Report it, but never block scene publication for that reason alone.
    const bindingIssues = committed
      ? inspectExecutedGetVals(result.parameterRequests, committed.snapshot)
      : { missing: [], invalid: [] };
    if (bindingIssues.invalid.length) {
      this.statusBar().showMessage(
        `Invalid numeric JSON get_val value(s): ${bindingIssues.invalid.join(', ')}`,
        6000,
        'error',
      );

      return;
    }
    if (!this.functions.active && this.session.mode === 'build') this.functions.acceptCalls(result);
    const scene = this.session.scene;
    this.inspectorCounts = {
      VariablesDock: result.variables.length,
      ParametersDock: this.parameters.rows.length,
      ApiTraceDock: result.apiCalls.length,
    };
    this.changed();

    this.variables.setRuntimeResult(result, line);
    this.apiTrace.setRuntimeResult(result);
    this.parameters.updateRuntimeResult(result);

    if (!this.importedObj) {
      if (this.editorTab === 'code') {
        this.viewport.setGeometryScene(scene);
        this.viewport.setRuntimeResult(result);
      }
    }
    this.links.updateRuntimeResult(result);
    this.selection.restoreAfterRun();

    if (result.diagnostics.length === 0) {
      const mode = this.session.mode === 'build' ? 'Build' : `Line ${line}`;
      let message = `${mode} | ${scene.meshes.length} live mesh(es) | ${result.apiCalls.length} API call(s)`;
      if (scene.warnings.length) message += ` | geometry warning: ${scene.warnings[scene.warnings.length - 1]}`;
      if (bindingIssues.missing.length)
        message += ` | unbound shared get_val: ${bindingIssues.missing.join(', ')} (verify preview)`;
      this.statusBar().showMessage(
        message,
        bindingIssues.missing.length ? 6000 : 2600,
        scene.warnings.length || bindingIssues.missing.length ? 'warning' : 'info',
      );
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

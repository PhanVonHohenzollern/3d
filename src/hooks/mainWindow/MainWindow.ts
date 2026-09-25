import { writeObj } from '../../core/formats/obj';
import type { InspectorCounts } from '../../types/dockArea';
import type { ConnectorPreview } from '../../core/geometry/ConnectorPreview';
import { PreviewGeometryEngine, type PreviewGeometryScene } from '../../core/geometry/PreviewGeometryEngine';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '../../core/runtime/DebugAnchorResolver';
import { GeometryRuntime } from '../../core/runtime/GeometryRuntime';
import { emptyRuntimeResult, type RuntimeResult } from '../../core/runtime/RuntimeTypes';
import { isApiDebugItemId } from '../../helpers/debugItems';
import {
  closestTarget,
  floatingWindowSelector,
  matchesKeySequence,
  quitKeySequence,
  textInputSelector,
} from '../../helpers/keyboard';
import { pointDeclaration, unusedPreviewPointName } from '../../helpers/viewportPoints';
import type { CodeEditorHandle, EditorExecutionFeedback } from '../../types/editor';
import type { ActionListItem, DockName, Menu, PreviewMode } from '../../types/mainWindow';
import type {
  ApiTracePanelHandle,
  LinkPanelHandle,
  ParameterPanelHandle,
  VariablePanelHandle,
} from '../../types/panels';
import type { Vec3, Viewport3DHandle } from '../../types/viewport';
import { what } from '../../utils/cpp';
import { Observable } from '../observable/Observable';
import { Action } from './Action';
import { SingleShotTimer } from './SingleShotTimer';
import { StatusBarModel } from './StatusBarModel';
import { FunctionWorkspace } from './FunctionWorkspace';

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
  readonly m_runtime = new GeometryRuntime();
  readonly m_geometryEngine = new PreviewGeometryEngine();
  m_geometryScene: PreviewGeometryScene = { meshes: [], warnings: [] };
  previewMode: PreviewMode = 'debug';
  buildNumber = 0;
  #buildSequence = 0;
  previewDirty = false;
  #builtSource: string | null = null;
  #builtProgram: ReturnType<FunctionWorkspace['program']> | undefined;
  #builtParameters: ReadonlyMap<string, string> | undefined;
  #previewProgram: ReturnType<FunctionWorkspace['program']> | undefined;
  #switchingEditor = false;
  readonly functions = new FunctionWorkspace();
  readonly #tabBuilds = new Map<
    string,
    {
      source: string;
      program: ReturnType<FunctionWorkspace['program']>;
      number: number;
      parameters: ReadonlyMap<string, string>;
    }
  >();
  #codeDirty = false;
  executionFeedback: EditorExecutionFeedback = { source: '', diagnostics: [] };

  get debugBlocked(): boolean {
    return this.previewMode === 'build' && this.#codeDirty;
  }

  get previewStatus(): string {
    if (this.previewMode === 'debug') return 'Debug · live preview';
    const errors =
      this.executionFeedback.diagnostics.length + (this.executionFeedback.externalDiagnostics?.length ?? 0);
    const pending = this.#codeDirty
      ? 'code changes pending — press Build'
      : 'parameter changes pending — press OK in Parameters';

    return `Build #${this.buildNumber} · ${this.previewDirty ? pending : errors ? `${errors} error(s)` : `${this.m_geometryScene.meshes.length} mesh(es)`}`;
  }

  importedObj: { name: string; scene: PreviewGeometryScene } | null = null;
  #connectorPreviews: readonly ConnectorPreview[] = [];
  #selectedConnectorId = -1;
  #showGeometryAction: Action | null = null;

  get canExportObj(): boolean {
    return (
      (this.importedObj?.scene.meshes.length ??
        this.m_geometryScene.meshes.length +
          this.#connectorPreviews.reduce((sum, preview) => sum + preview.meshes.length, 0)) > 0
    );
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

    return writeObj(
      this.importedObj?.scene ?? {
        meshes: [...this.m_geometryScene.meshes, ...this.#connectorPreviews.flatMap((preview) => preview.meshes)],
        warnings: [],
      },
    );
  }

  inspectorCounts: InspectorCounts = { VariablesDock: 0, ParametersDock: 0, ApiTraceDock: 0 };
  m_lastResult: RuntimeResult = emptyRuntimeResult();
  m_currentPreviewLine = 0;
  m_navigatingToTrace = false;
  m_browsingTrace = false;

  readonly #statusBar = new StatusBarModel();
  #raisedDock: DockName = 'ParametersDock';
  menus: Menu[] = [];
  toolbarItems: ActionListItem[] = [];
  shortcutActions: Action[] = [];

  constructor() {
    super();
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
      this.functions.error = what(error);
      this.changed();

      return;
    }
    this.buildNumber = ++this.#buildSequence;
    this.updatePreview(source.split('\n').length, source, program);
    this.#builtSource = source;
    this.#builtProgram = program;
    this.#builtParameters = this.m_parameters.overrides();
    this.#tabBuilds.set(this.functions.active, {
      source,
      program,
      number: this.buildNumber,
      parameters: this.#builtParameters,
    });
    this.#codeDirty = false;
    this.previewDirty = false;
    this.changed();
  };

  readonly debugPreview = (): void => {
    if (this.debugBlocked) return;
    this.activatePreviewMode('debug');
    this.runPreview();
  };

  private activatePreviewMode(mode: PreviewMode): void {
    this.m_previewTimer.stop();
    this.previewMode = mode;
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
    this.#codeDirty =
      this.m_editor.toPlainText() !== this.#builtSource ||
      (!!this.#builtProgram &&
        this.functions.program(this.m_editor.toPlainText(), false).source !== this.#builtProgram.source);
    this.previewDirty = true;
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
    this.previewDirty = true;
    this.changed();
    this.runPreview();
  };

  readonly applyParameters = (): void => {
    this.m_parameters.commitEditor();
    this.importedObj = null;
    if (this.previewMode === 'build' && this.#builtSource !== null) {
      // Parameter changes rerun the built code without applying pending source edits.
      let program = this.#builtProgram;
      try {
        if (program)
          program = {
            ...program,
            options: { ...program.options, arguments: this.functions.program(this.#builtSource).options.arguments },
          };
      } catch (error) {
        this.functions.error = what(error);
        this.changed();

        return;
      }
      this.updatePreview(this.#builtSource.split('\n').length, this.#builtSource, program);
      this.#builtProgram = program;
      this.#builtParameters = this.m_parameters.overrides();
      if (program)
        this.#tabBuilds.set(this.functions.active, {
          source: this.#builtSource,
          program,
          number: this.buildNumber,
          parameters: this.#builtParameters,
        });
      this.previewDirty = this.#codeDirty;
    } else {
      this.runPreview();
      this.previewDirty = false;
    }
    this.changed();
  };

  readonly addFunction = (name: string): boolean => {
    this.m_parameters.commitEditor();
    this.functions.edit(this.m_editor.toPlainText());
    if (!this.functions.add(name)) {
      this.changed();

      return false;
    }
    this.showFunctionEditor();

    return true;
  };

  readonly selectFunction = (name: string): void => {
    if (name === this.functions.active || (name && !this.functions.names.includes(name))) return;
    this.m_parameters.commitEditor();
    this.functions.edit(this.m_editor.toPlainText());
    this.functions.active = name;
    this.functions.error = '';
    this.showFunctionEditor();
  };

  readonly saveFunction = (): void => {
    this.functions.edit(this.m_editor.toPlainText());
    if (this.functions.save()) this.showFunctionEditor();
    this.changed();
  };

  readonly cancelFunction = (): void => {
    const name = this.functions.active;
    this.functions.cancel();
    this.#tabBuilds.delete(name);
    this.showFunctionEditor();
  };

  readonly attachFunction = (): void => {
    this.functions.edit(this.m_editor.toPlainText());
    if (this.functions.attach()) this.statusBar().showMessage('Function attached to the main code.', 2600);
    this.changed();
  };

  readonly deleteFunction = (): void => {
    if (!this.functions.active) return;
    this.m_parameters.commitEditor();
    const name = this.functions.removeActive();
    if (!name) return;
    this.m_previewTimer.stop();
    this.#tabBuilds.delete(name);
    for (const built of this.#tabBuilds.values())
      built.parameters = new Map([...built.parameters].filter(([key]) => !key.startsWith(`${name}::`)));
    this.m_parameters.forgetFunction?.(name);
    this.showFunctionEditor();
    this.statusBar().showMessage(`Function ${name} deleted.`, 2600);
  };

  get canEditSubParameters(): boolean {
    return !!this.functions.active && this.functions.parameterFunctions.length > 0;
  }

  readonly setFunctionInput = (
    name: string,
    parameter: string,
    initial: string[],
    index: number,
    value: string,
  ): void => {
    if (!this.canEditSubParameters) return;
    this.functions.setInput(name, parameter, initial, index, value);
    this.onParametersChanged();
  };

  readonly selectFunctionInputs = (name: string): void => {
    if (!this.canEditSubParameters) return;
    this.functions.inputTab = name;
    this.changed();
  };

  readonly applyFunctionInputs = (name: string): void => {
    if (!this.canEditSubParameters || !this.functions.parameterFunctions.some((fn) => fn.name === name)) return;
    this.selectFunction(name);
    this.applyParameters();
  };

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
    this.functions.inputTab = this.functions.active;
    this.m_lastResult = emptyRuntimeResult();
    this.m_geometryScene = { meshes: [], warnings: [] };
    this.executionFeedback = { source: this.functions.source(), diagnostics: [] };
    this.m_viewport.setGeometryScene(this.m_geometryScene);
    this.m_viewport.setRuntimeResult(this.m_lastResult);
    this.m_variables.setRuntimeResult(this.m_lastResult, 1);
    this.m_apiTrace.setRuntimeResult(this.m_lastResult);
    const built = this.#tabBuilds.get(this.functions.active);
    this.#builtSource = built?.source ?? null;
    this.#builtProgram = built?.program;
    this.#builtParameters = built?.parameters;
    const currentProgram = this.functions.program(this.functions.source(), false);
    this.#codeDirty =
      !!built && (this.functions.source() !== built.source || currentProgram.source !== built.program.source);
    this.previewDirty = this.#codeDirty;
    if (this.previewMode === 'build') {
      if (built) {
        this.buildNumber = built.number;
        this.updatePreview(built.source.split('\n').length, built.source, built.program, built.parameters);
        const current = [...this.m_parameters.overrides()].sort(([a], [b]) => a.localeCompare(b));
        const previous = [...built.parameters].sort(([a], [b]) => a.localeCompare(b));
        this.previewDirty ||= JSON.stringify(current) !== JSON.stringify(previous);
        this.previewDirty ||=
          JSON.stringify([...(currentProgram.options.arguments ?? [])]) !==
          JSON.stringify([...(built.program.options.arguments ?? [])]);
      } else this.buildPreview();
    } else this.runPreview();
    this.m_parameters.selectTab?.(this.functions.active || this.functions.inline[0]?.name || '');
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
    if (line > this.executionFeedback.source.split('\n').length && this.#previewProgram) {
      const location = this.#previewProgram.locations.findLast((entry) => line >= entry.start && line <= entry.end);
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

  raisedDock(): DockName {
    return this.#raisedDock;
  }

  readonly raiseDock = (name: DockName): void => {
    if (name === 'SubParametersDock' && !this.canEditSubParameters) return;
    if (this.#raisedDock === name) return;
    this.#raisedDock = name;
    this.changed();
  };

  createActions(): void {
    const exitAction = new Action('E&xit');
    exitAction.setShortcut(quitKeySequence);
    exitAction.onTriggered(() => window.close());

    const runAction = new Action('&Run Preview');
    runAction.setShortcut({ key: 'r', control: true });
    const clearFocusAction = new Action('Clear API Focus');
    clearFocusAction.onTriggered(() => this.m_apiTrace.clearApiFocus());

    const showGeometryAction = new Action('Show &Geometry');
    this.#showGeometryAction = showGeometryAction;
    showGeometryAction.setCheckable(true);
    showGeometryAction.setChecked(true);

    const wireframeAction = new Action('Geometry &Wireframe');
    wireframeAction.setCheckable(true);
    wireframeAction.setChecked(false);

    const fitSceneAction = new Action('Fit &Scene');

    const showPointsAction = new Action('Show &Points');
    showPointsAction.setCheckable(true);
    showPointsAction.setChecked(true);

    const showVectorsAction = new Action('Show &Vectors');
    showVectorsAction.setCheckable(true);
    showVectorsAction.setChecked(true);

    const showLabelsAction = new Action('Show &Labels');
    showLabelsAction.setCheckable(true);
    showLabelsAction.setChecked(true);

    const fitAction = new Action('&Fit Debug');
    fitAction.setShortcut({ key: 'f' });

    const hideSelectedAction = new Action('Hide Selected');
    hideSelectedAction.setShortcut({ key: 'h' });
    const showSelectedAction = new Action('Show Selected');
    showSelectedAction.setShortcut({ key: 'h', shift: true });
    const hideAllDebugAction = new Action('Hide All Debug');
    const showAllDebugAction = new Action('Show All Debug');

    this.menus = [
      { title: '&File', items: [exitAction] },
      {
        title: '&Preview',
        items: [
          runAction,
          clearFocusAction,
          'separator',
          showGeometryAction,
          wireframeAction,
          fitSceneAction,
          'separator',
          showPointsAction,
          showVectorsAction,
          showLabelsAction,
          fitAction,
          'separator',
          hideSelectedAction,
          showSelectedAction,
          hideAllDebugAction,
          showAllDebugAction,
        ],
      },
    ];
    this.toolbarItems = [
      showGeometryAction,
      wireframeAction,
      fitSceneAction,
      'separator',
      showPointsAction,
      showVectorsAction,
      showLabelsAction,
      'separator',
      hideSelectedAction,
      showSelectedAction,
    ];
    this.shortcutActions = [exitAction, runAction, fitAction, hideSelectedAction, showSelectedAction];

    runAction.onTriggered(() => {
      if (this.previewMode === 'build') this.buildPreview();
      else this.runPreview();
    });
    showGeometryAction.onToggled((checked) => this.m_viewport.setShowGeometry(checked));
    wireframeAction.onToggled((checked) => this.m_viewport.setGeometryWireframe(checked));
    fitSceneAction.onTriggered(() => this.m_viewport.fitScene());
    showPointsAction.onToggled((checked) => this.m_viewport.setShowPoints(checked));
    showVectorsAction.onToggled((checked) => this.m_viewport.setShowVectors(checked));
    showLabelsAction.onToggled((checked) => this.m_viewport.setShowLabels(checked));
    fitAction.onTriggered(() => this.m_viewport.fitDebugOverlay());
    hideSelectedAction.onTriggered(() => {
      let names = this.m_apiTrace.selectedDebugItems();
      if (names.size === 0) names = this.m_viewport.selectedDebugItems();
      if (names.size === 0) {
        this.statusBar().showMessage(
          'Select a point/vector parameter in API Trace, Variables, or the viewport first',
          2500,
        );

        return;
      }
      for (const name of names) this.m_viewport.setDebugItemVisible(name, false);
      this.statusBar().showMessage(`Hidden ${names.size} selected debug item(s)`, 1800);
    });
    showSelectedAction.onTriggered(() => {
      let names = this.m_apiTrace.selectedDebugItems();
      if (names.size === 0) names = this.m_viewport.selectedDebugItems();
      if (names.size === 0) {
        this.statusBar().showMessage('Select a point/vector parameter in API Trace or Variables first', 2500);

        return;
      }
      for (const name of names) this.m_viewport.setDebugItemVisible(name, true);
      this.statusBar().showMessage(`Shown ${names.size} selected debug item(s)`, 1800);
    });
    hideAllDebugAction.onTriggered(() => {
      this.m_viewport.hideAllDebugItems();
      this.statusBar().showMessage('All point/vector debug items hidden', 1800);
    });
    showAllDebugAction.onTriggered(() => {
      showPointsAction.setChecked(true);
      showVectorsAction.setChecked(true);
      showLabelsAction.setChecked(true);
      this.m_viewport.showAllDebugItems();
      this.statusBar().showMessage('All point/vector debug overlays shown', 1800);
    });
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
      this.functions.error = what(error);
      this.changed();

      return;
    }
    this.functions.error = '';
    this.#previewProgram = program;
    const parameterDefinitions = this.m_runtime
      .discoverParameters(program.source)
      .filter((definition) => !definition.functionName || !this.functions.deleted.has(definition.functionName));
    this.m_parameters.setDefinitions(parameterDefinitions, program.source, program.options);

    this.m_runtime.setParameters(parameters ?? this.m_parameters.overrides());
    let result: RuntimeResult;
    try {
      result = this.m_runtime.executeUpToLine(program.source, line, this.previewMode === 'build', program.options);
    } catch (e) {
      this.executionFeedback = { source, diagnostics: [{ line, message: what(e) }] };
      this.changed();
      this.statusBar().showMessage(`Line ${line}: preview stopped: ${what(e)}`, 4000, 'error');

      return;
    }
    const sourceLines = source.split('\n').length;
    this.executionFeedback = {
      source,
      diagnostics: result.diagnostics.filter((d) => d.line <= sourceLines),
      externalDiagnostics: result.diagnostics
        .filter((d) => d.line > sourceLines)
        .map((d) => {
          const location = program.locations.findLast((entry) => d.line >= entry.start && d.line <= entry.end);

          return {
            name: location?.name || 'Main',
            line: location ? d.line - location.start + location.localStart : d.line,
            sourceLine: d.line,
            message: d.message,
          };
        }),
    };
    this.inspectorCounts = {
      VariablesDock: result.variables.length,
      ParametersDock: parameterDefinitions.reduce(
        (count, definition) => count + (definition.sourceFunction === 'getExtInsSize' ? 2 : 1),
        0,
      ),
      ApiTraceDock: result.apiCalls.length,
    };
    this.changed();
    this.m_lastResult = result;
    this.m_currentPreviewLine = line;

    this.m_variables.setRuntimeResult(result, line);
    this.m_apiTrace.setRuntimeResult(result);
    this.m_parameters.updateRuntimeResult(result);

    this.m_geometryScene = this.m_geometryEngine.build(result);
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
    const calls = this.m_lastResult.apiCalls;
    for (let i = 0; i < calls.length; ++i) {
      let parent = calls[i].parentApiIndex;
      while (parent >= 0) {
        if (selectedCalls.has(parent)) {
          focusedApiIndices.add(i);
          break;
        }
        if (parent >= calls.length) break;
        parent = calls[parent].parentApiIndex;
      }
    }
    this.m_viewport.setApiFocusIndices(focusedApiIndices);

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

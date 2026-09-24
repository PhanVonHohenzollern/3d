// Port of app/MainWindow.{h,cpp} (and the window setup of app/main.cpp).
//
// MainWindow drives one pipeline. A text change or cursor move in CodeEditor
// starts a 220 ms single-shot timer that calls runPreview():
//   discoverParameters(whole source) -> ParameterPanel -> setParameters ->
//   executeUpToLine(source, cursor line or trace-browsing line) -> panels ->
//   PreviewGeometryEngine.build -> Viewport3D -> Link -> API focus.
// Nothing downstream re-executes code: selection, API focus, trace browsing
// and history navigation only read the captured RuntimeResult snapshots.
//
// The MainWindow class below is a line-by-line port. It holds the runtime,
// the geometry engine and the preview state (the C++ members) and reaches the
// widgets through React refs whose handles mirror the Qt widgets' public
// methods; the panels keep their own state and fire their callbacks
// synchronously, so the call order and re-entrancy match the Qt signals.
// The App component only lays the widgets out (menu bar, tool bar, central
// splitter, bottom dock area, status bar).

import {
  createRef, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { CodeEditor, type CodeEditorHandle } from '../editor/CodeEditor';
import type { ConnectorPreview } from '../geometry/ConnectorPreview';
import { PreviewGeometryEngine, type PreviewGeometryScene } from '../geometry/PreviewGeometryEngine';
import { Viewport3D } from '../renderer/Viewport3D';
import { isApiDebugItemId, type Vec3, type Viewport3DHandle } from '../renderer/Viewport3DHandle';
import { formatFixed, what } from '../runtime/CppCompat';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '../runtime/DebugAnchorResolver';
import { GeometryRuntime } from '../runtime/GeometryRuntime';
import { emptyRuntimeResult, type RuntimeResult } from '../runtime/RuntimeTypes';
import { ApiTracePanel, type ApiTracePanelHandle } from '../ui/ApiTracePanel';
import { LinkPanel, type LinkPanelHandle } from '../ui/LinkPanel';
import { Observable, useObservable } from '../ui/Observable';
import { ParameterPanel, type ParameterPanelHandle } from '../ui/ParameterPanel';
import { VariablePanel, type VariablePanelHandle } from '../ui/VariablePanel';
import { Action, matchesKeySequence, quitKeySequence } from './Action';
import { MenuBar, ToolBar, type ActionListItem, type Menu } from './MenuBar';
import { Splitter } from './Splitter';
import { StatusBar, StatusBarModel } from './StatusBar';
import './theme.css';
import './App.css';

function formatCoordinate(value: number): string {
  value = Math.fround(value); // QVector3D components are floats
  if (Math.abs(value) < Math.fround(0.0005)) value = 0.0;
  let text = formatFixed(value, 3);
  while (text.includes('.') && text.endsWith('0')) text = text.slice(0, -1);
  if (text.endsWith('.')) text = text.slice(0, -1);
  return text;
}

/** QRegularExpression::escape() for the \b...\b candidate search. */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** QTimer with setSingleShot(true): start() (re)starts the interval. */
class SingleShotTimer {
  #id: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly interval: number, private readonly timeout: () => void) {}
  start(): void {
    this.stop();
    this.#id = setTimeout(() => { this.#id = undefined; this.timeout(); }, this.interval);
  }
  stop(): void {
    if (this.#id !== undefined) clearTimeout(this.#id);
    this.#id = undefined;
  }
}

export type DockName = 'VariablesDock' | 'ParametersDock' | 'ApiTraceDock' | 'LinkDock';

export class MainWindow extends Observable {
  // Widgets (the C++ pointer members), reached through React refs.
  readonly editorRef = createRef<CodeEditorHandle>();
  readonly viewportRef = createRef<Viewport3DHandle>();
  readonly variablesRef = createRef<VariablePanelHandle>();
  readonly parametersRef = createRef<ParameterPanelHandle>();
  readonly apiTraceRef = createRef<ApiTracePanelHandle>();
  readonly linksRef = createRef<LinkPanelHandle>();
  get m_editor(): CodeEditorHandle { return this.editorRef.current!; }
  get m_viewport(): Viewport3DHandle { return this.viewportRef.current!; }
  get m_variables(): VariablePanelHandle { return this.variablesRef.current!; }
  get m_parameters(): ParameterPanelHandle { return this.parametersRef.current!; }
  get m_apiTrace(): ApiTracePanelHandle { return this.apiTraceRef.current!; }
  get m_links(): LinkPanelHandle { return this.linksRef.current!; }

  readonly m_previewTimer = new SingleShotTimer(220, () => this.runPreview());
  readonly m_runtime = new GeometryRuntime();
  readonly m_geometryEngine = new PreviewGeometryEngine();
  m_geometryScene: PreviewGeometryScene = { meshes: [], warnings: [] };
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

  statusBar(): StatusBarModel { return this.#statusBar; }

  /**
   * The rest of MainWindow::MainWindow(), run once the widgets exist. The
   * signal connections are the callback props passed in App below.
   */
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

  // --- connections (MainWindow::MainWindow) ------------------------------------
  readonly onEditorTextChanged = (): void => {
    this.m_editor.setTraceSourceLines(new Set());
    this.schedulePreview();
  };

  readonly onEditorCursorPositionChanged = (): void => {
    if (this.m_navigatingToTrace) return;
    this.m_editor.setTraceSourceLines(new Set());
    this.m_browsingTrace = false;
    this.schedulePreview();
  };

  readonly onParametersChanged = (): void => { this.runPreview(); };

  readonly linkExpressionEvaluator = (expression: string): number =>
    this.m_runtime.evaluateNumericExpression(expression);

  readonly onLinkPreviewChanged = (previews: readonly ConnectorPreview[], selectedId: number, tested: boolean): void => {
    if (tested) this.m_apiTrace.clearApiFocus();
    this.m_viewport.setConnectorPreviews(previews, selectedId);
    if (tested) this.m_viewport.fitScene();
  };

  readonly onViewportConnectorSelection = (id: number): void => {
    this.m_links.selectConnector(id);
    this.raiseDock('LinkDock');
  };

  // API Trace -> geometry focus. Selecting a call shows its evaluated
  // arguments and temporarily hides unrelated debug geometry.
  readonly onApiTraceSelectionChanged = (apiIndex: number): void => {
    this.applyApiFocus(apiIndex);
    // A selected parameter row maps directly to the corresponding immutable
    // API point/vector snapshot. Selecting the API root clears only the
    // per-parameter highlight.
    this.m_viewport.setSelectedVariables(this.m_apiTrace.selectedDebugItems());
    this.m_editor.setTraceSourceLines(this.m_apiTrace.selectedSourceLines());
  };

  readonly onApiTraceSourceActivated = (line: number): void => {
    this.navigateToSource(line, this.m_apiTrace.selectedSourceLines());
  };

  readonly onApiTraceHistorySourceActivated = (line: number): void => {
    this.navigateToSource(line, new Set([line]));
  };

  // Variable table -> viewport selection.
  readonly onVariableSelectionChanged = (name: string): void => {
    this.selectRuntimeDebugVariables(new Set([name]));
  };

  // Viewport click -> variable table selection.
  readonly onViewportSelectionChanged = (names: Set<string>): void => {
    const parameters = new Set<string>();
    for (const name of names) if (isApiDebugItemId(name)) parameters.add(name);
    if (parameters.size || this.m_viewport.hasApiFocus()) this.m_apiTrace.selectDebugItems(parameters);
    else this.selectRuntimeDebugVariables(names);
  };

  readonly onViewportMeshSelection = (apiIndex: number, sourceLine: number): void => {
    this.m_apiTrace.selectMeshApiCall(apiIndex);
    this.navigateToSource(sourceLine, new Set([sourceLine]));
  };

  // Ctrl+click on the XY plane creates a real declaration in the editor.
  readonly onViewportPointCreation = (point: Vec3): void => {
    this.insertPointFromViewport(point);
  };

  // --- MainWindow methods --------------------------------------------------------
  navigateToSource(line: number, lines: ReadonlySet<number>): void {
    // findBlockByNumber(line - 1).isValid()
    if (line < 1 || line > this.m_editor.blockCount()) return;
    const navigation = this.m_navigatingToTrace; // QScopedValueRollback
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
    // Clearing Trace focus also resets the viewport's selection. Keep the
    // clicked identities independently of that re-entrant callback.
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
      primary = name; primaryLine = variable.lastChangedLine;
    }
    if (primary !== '') this.m_variables.selectVariable(primary);
    if (primaryLine > 0) this.navigateToSource(primaryLine, lines);
    else this.m_editor.setTraceSourceLines(lines);
  }

  /** createCentralArea() is the App layout; createDockPanels() sets the raised tab. */
  createDockPanels(): void {
    this.#raisedDock = 'ParametersDock'; // parametersDock->raise();
  }

  raisedDock(): DockName { return this.#raisedDock; }

  /** QDockWidget::raise() */
  raiseDock(name: DockName): void {
    if (this.#raisedDock === name) return;
    this.#raisedDock = name;
    this.changed();
  }

  createActions(): void {
    const exitAction = new Action('E&xit');
    exitAction.setShortcut(quitKeySequence);
    exitAction.onTriggered(() => window.close());

    const runAction = new Action('&Run Preview');
    runAction.setShortcut({ key: 'r', control: true });
    const clearFocusAction = new Action('Clear API Focus');
    clearFocusAction.onTriggered(() => this.m_apiTrace.clearApiFocus());

    const showGeometryAction = new Action('Show &Geometry');
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
          runAction, clearFocusAction, 'separator',
          showGeometryAction, wireframeAction, fitSceneAction, 'separator',
          showPointsAction, showVectorsAction, showLabelsAction, fitAction, 'separator',
          hideSelectedAction, showSelectedAction, hideAllDebugAction, showAllDebugAction,
        ],
      },
    ];
    this.toolbarItems = [
      runAction, 'separator',
      showGeometryAction, wireframeAction, fitSceneAction, 'separator',
      showPointsAction, showVectorsAction, showLabelsAction, fitAction, 'separator',
      hideSelectedAction, showSelectedAction, hideAllDebugAction, showAllDebugAction,
    ];
    this.shortcutActions = [exitAction, runAction, fitAction, hideSelectedAction, showSelectedAction];

    runAction.onTriggered(() => this.runPreview());
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
        this.statusBar().showMessage('Select a point/vector parameter in API Trace, Variables, or the viewport first', 2500);
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
      // Show only the selected item. Do not enable unrelated debug items.
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

  /** QShortcut(Qt::Key_Escape) "ExitPreviewFocus" */
  readonly exitPreviewFocus = (): void => {
    this.m_links.exitPreview();
    this.m_apiTrace.clearApiFocus();
  };

  schedulePreview(): void {
    this.m_previewTimer.start();
  }

  runPreview(): void {
    const line = this.m_browsingTrace ? this.m_currentPreviewLine : this.m_editor.currentLine();
    const source = this.m_editor.toPlainText();

    // Parameters are discovered from the ENTIRE source before execution. This
    // keeps every get_val(...) visible/editable even when the cursor is above
    // the call or the call is inside a branch that is not currently executed.
    const parameterDefinitions = this.m_runtime.discoverParameters(source);
    this.m_parameters.setDefinitions(parameterDefinitions);

    this.m_runtime.setParameters(this.m_parameters.values());
    let result: RuntimeResult;
    try {
      result = this.m_runtime.executeUpToLine(source, line);
    } catch (e) {
      // Web-only guard: pathological nesting can exhaust the JavaScript stack
      // (the C++ app would crash). Keep the previous preview and report it.
      this.statusBar().showMessage(`Line ${line}: preview stopped: ${what(e)}`, 4000);
      return;
    }
    this.m_lastResult = result;
    this.m_currentPreviewLine = line;

    this.m_variables.setRuntimeResult(result, line);
    this.m_apiTrace.setRuntimeResult(result);
    this.m_parameters.updateRuntimeResult(result);

    this.m_geometryScene = this.m_geometryEngine.build(result);
    this.m_viewport.setGeometryScene(this.m_geometryScene);
    this.m_viewport.setRuntimeResult(result);
    this.m_links.updateRuntimeResult(result);
    this.applyApiFocus(this.m_apiTrace.selectedApiCall());

    const selected = this.m_variables.selectedVariable();
    if (this.m_apiTrace.selectedApiCall() >= 0) this.m_viewport.setSelectedVariables(this.m_apiTrace.selectedDebugItems());
    else if (selected !== '') this.m_viewport.setSelectedVariable(selected);

    if (result.diagnostics.length === 0) {
      let message = `Line ${line} | ${this.m_geometryScene.meshes.length} live mesh(es) | ${result.apiCalls.length} API call(s)`;
      if (this.m_geometryScene.warnings.length)
        message += ` | geometry warning: ${this.m_geometryScene.warnings[this.m_geometryScene.warnings.length - 1]}`;
      this.statusBar().showMessage(message, 2600);
    } else {
      const d = result.diagnostics[result.diagnostics.length - 1];
      this.statusBar().showMessage(`Line ${d.line}: ${d.message}`, 4000);
    }
  }

  applyApiFocus(apiIndex: number): void {
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
        if (selectedCalls.has(parent)) { focusedApiIndices.add(i); break; }
        if (parent >= calls.length) break;
        parent = calls[parent].parentApiIndex;
      }
    }
    this.m_viewport.setApiFocusIndices(focusedApiIndices);

    const call = calls[apiIndex];
    const snapshotDebugCount = resolveDebugPointSnapshots(call).length + resolveDebugVectorAnchors(call).length;
    this.statusBar().showMessage(
      `API #${apiIndex + 1} ${call.name} | ${snapshotDebugCount} point/vector input(s), ${focusedApiIndices.size} call(s) in focus`,
      3000);
  }

  insertPointFromViewport(point: Vec3): void {
    const name = this.nextPreviewPointName();
    const declaration = `FdPoint3d ${name}(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)}, ${formatCoordinate(point.z)});`;

    // cursor.movePosition(EndOfBlock); a non-blank block gets a new line first.
    const newLine = this.m_editor.cursorBlockText().trim() === '' ? '' : '\n';
    this.m_editor.insertAtCursorBlockEnd(`${newLine}${declaration}\n`);
    this.m_editor.setFocus();

    this.statusBar().showMessage(`Inserted ${name} from viewport: ${declaration}`, 3000);
    this.schedulePreview();
  }

  nextPreviewPointName(): string {
    const code = this.m_editor.toPlainText();
    for (let i = 1; i < 10000; ++i) {
      const candidate = `pPreview${i}`;
      const re = new RegExp(`\\b${escapeRegExp(candidate)}\\b`);
      if (!re.test(code)) return candidate;
    }
    return 'pPreview';
  }

  /**
   * Window-level key handling: QAction shortcuts and the Esc QShortcut.
   * Single-key shortcuts yield to text input (Qt's ShortcutOverride); keys in
   * the Earlier values window never reach this (it is another window).
   */
  handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as Element | null;
    const closest = (selectors: string) => (typeof target?.closest === 'function' ? target.closest(selectors) : null);
    if (closest('.floating-window')) return;
    if (event.key === 'Escape') {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      this.exitPreviewFocus();
      return;
    }
    const textInput = !!closest('input, textarea, [contenteditable="true"], .cm-content');
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

// ---------------------------------------------------------------------------

const kDocks: readonly { name: DockName; title: string }[] = [
  { name: 'VariablesDock', title: 'Variables' },
  { name: 'ParametersDock', title: 'Parameters' },
  { name: 'ApiTraceDock', title: 'API Trace' },
  { name: 'LinkDock', title: 'Link' },
];

const kMinimumDockHeight = 60;
const kMinimumCentralHeight = 80;

export function App() {
  const [mainWindow] = useState(() => new MainWindow());
  useObservable(mainWindow);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(() => Math.round(window.innerHeight * 0.3));

  useEffect(() => {
    document.title = 'Geometry Preview';
    const onKeyDown = (event: KeyboardEvent) => mainWindow.handleKeyDown(event);
    window.addEventListener('keydown', onKeyDown);
    mainWindow.start();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      mainWindow.dispose();
    };
  }, [mainWindow]);

  // QMainWindow keeps the dock height while the central widget absorbs
  // window resizes; the dock only shrinks when the window becomes too small.
  useLayoutEffect(() => {
    const area = mainAreaRef.current;
    if (!area) return;
    const clamp = () => setDockHeight((height) =>
      Math.max(Math.min(height, area.clientHeight - kMinimumCentralHeight), kMinimumDockHeight));
    const observer = new ResizeObserver(clamp);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const onSeparatorPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = dockHeight;
    const available = (mainAreaRef.current?.clientHeight ?? window.innerHeight) - kMinimumCentralHeight;
    const move = (e: PointerEvent) =>
      setDockHeight(Math.max(Math.min(startHeight - (e.clientY - startY), available), kMinimumDockHeight));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  const raised = mainWindow.raisedDock();
  const panels: Record<DockName, ReactNode> = {
    VariablesDock: <VariablePanel ref={mainWindow.variablesRef} onSelectionChanged={mainWindow.onVariableSelectionChanged} />,
    ParametersDock: <ParameterPanel ref={mainWindow.parametersRef} onChanged={mainWindow.onParametersChanged} />,
    ApiTraceDock: (
      <ApiTracePanel
        ref={mainWindow.apiTraceRef}
        onSelectionChanged={mainWindow.onApiTraceSelectionChanged}
        onSourceActivated={mainWindow.onApiTraceSourceActivated}
        onHistorySourceActivated={mainWindow.onApiTraceHistorySourceActivated}
      />
    ),
    LinkDock: (
      <LinkPanel
        ref={mainWindow.linksRef}
        expressionEvaluator={mainWindow.linkExpressionEvaluator}
        onPreviewChanged={mainWindow.onLinkPreviewChanged}
      />
    ),
  };

  return (
    <div className="main-window">
      <MenuBar menus={mainWindow.menus} />
      <ToolBar items={mainWindow.toolbarItems} />
      <div ref={mainAreaRef} className="main-area">
        <div className="central-widget">
          <Splitter orientation="horizontal" initialSizes={[600, 900]} stretchFactors={[4, 6]}>
            <CodeEditor
              ref={mainWindow.editorRef}
              onTextChanged={mainWindow.onEditorTextChanged}
              onCursorPositionChanged={mainWindow.onEditorCursorPositionChanged}
            />
            <div className="viewport-container">
              <Viewport3D
                ref={mainWindow.viewportRef}
                onSelectionChanged={mainWindow.onViewportSelectionChanged}
                onPointCreation={mainWindow.onViewportPointCreation}
                onMeshSelection={mainWindow.onViewportMeshSelection}
                onConnectorSelection={mainWindow.onViewportConnectorSelection}
              />
            </div>
          </Splitter>
        </div>
        <div className="dock-separator" onPointerDown={onSeparatorPointerDown} />
        <div className="dock-area" style={{ height: dockHeight }}>
          <div className="dock-title">{kDocks.find((dock) => dock.name === raised)?.title}</div>
          <div className="dock-stack">
            {kDocks.map((dock) => (
              <div key={dock.name} className="dock-widget" hidden={dock.name !== raised}>{panels[dock.name]}</div>
            ))}
          </div>
          <div className="dock-tabs" role="tablist">
            {kDocks.map((dock) => (
              <button
                key={dock.name}
                type="button"
                role="tab"
                aria-selected={dock.name === raised}
                className={`dock-tab${dock.name === raised ? ' selected' : ''}`}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => mainWindow.raiseDock(dock.name)}
              >
                {dock.title}
              </button>
            ))}
          </div>
        </div>
      </div>
      <StatusBar model={mainWindow.statusBar()} />
    </div>
  );
}

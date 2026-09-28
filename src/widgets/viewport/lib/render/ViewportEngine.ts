import type { MouseEventData, WheelEventData } from '@/shared/lib/qt';
import { setsEqual } from '@/shared/lib/sets';
import type { TextMeasurer } from '@/shared/lib/text';
import { kNextSelectionMode, kSelectionModeNames } from '@/widgets/viewport/config/viewport';
import type { QRect } from '@/widgets/viewport/lib/math/Rect';
import { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import type { DebugLabelPanel } from '@/widgets/viewport/lib/render/DebugLabelPanel';
import { buildDebugItems } from '@/widgets/viewport/lib/render/debugItems';
import { OverlayLayer } from '@/widgets/viewport/lib/render/OverlayLayer';
import { PickingService } from '@/widgets/viewport/lib/render/PickingService';
import { SceneRenderer } from '@/widgets/viewport/lib/render/SceneRenderer';
import { SurfaceBinding } from '@/widgets/viewport/lib/render/SurfaceBinding';
import type { SelectionModeButtonState, ViewportSurface } from '@/widgets/viewport/lib/render/types';
import type { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import { ViewportInput, type InputHost, type ViewportCallbacks } from '@/widgets/viewport/lib/render/ViewportInput';
import { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';
import type { Vec3 } from '@/widgets/viewport/model/types';
import type { ConnectorPreview, PreviewGeometryScene } from '@engine/geometry';
import type { RuntimeResult } from '@engine/runtime';

// The 3D viewport's public face, wiring its parts together: what is shown and selected
// (ViewportState), the camera (CameraController), hit testing (PickingService), the 2D layer
// (OverlayLayer), the GL scene (SceneRenderer), mouse input (ViewportInput) and the canvases
// (SurfaceBinding).
export class ViewportEngine {
  readonly #widgetListeners = new Set<() => void>();
  readonly #state = new ViewportState();
  readonly #view = new CameraController(this.#state);
  readonly #pickers = new PickingService(this.#state, this.#view);
  readonly #overlay = new OverlayLayer(this.#state, this.#view, () => this.#notifyWidgets());
  readonly #scene = new SceneRenderer(this.#state, this.#view);
  readonly #callbacks: ViewportCallbacks = {
    selectionChanged: null,
    pointCreation: null,
    meshSelection: null,
    connectorSelection: null,
  };
  readonly #input = new ViewportInput(this.#state, this.#view, this.#pickers, this.#overlay, this.#inputHost());
  readonly #surface = new SurfaceBinding(this.#view, this.#overlay, this.#scene, {
    rebuildVertices: () => this.#rebuildGpuVertices(),
    clearHover: () => this.#input.clearHover(),
  });
  #hasFitOnce = false;

  constructor() {
    this.#updateSelectionModeButton();
    for (const panel of this.#overlay.panels) {
      panel.setParentUpdate(() => this.update());
      panel.setActivatedCallback((ids, additive) => {
        const selected = additive ? new Set(this.#state.selectedVariables) : new Set<string>();
        for (const id of panel.itemIds()) selected.delete(id);
        for (const id of ids) selected.add(id);
        this.setSelectedVariables(selected);
        this.#selectionChanged();
      });
    }
    this.#overlay.layout(this.#surface.width, this.#surface.height);
  }

  // Selection presentation and mode.

  selectionPresentation = (): 'Separate' | 'Unite' => this.#state.selectionPresentation;

  toggleSelectionPresentation(): void {
    const state = this.#state;
    state.selectionPresentation = state.selectionPresentation === 'Separate' ? 'Unite' : 'Separate';
    this.#pickers.invalidate();
    this.#input.clearHover();
    this.#rebuildGpuVertices();
    this.#notifyWidgets();
    this.update();
  }

  selectionModeButtonClicked(): void {
    this.#pickers.invalidate();
    this.#state.selectionMode = kNextSelectionMode[this.#state.selectionMode];
    this.#input.clearHover();
    this.#updateSelectionModeButton();
    this.#overlay.layout(this.#surface.width, this.#surface.height);
  }

  subscribeWidgets = (listener: () => void): (() => void) => {
    this.#widgetListeners.add(listener);

    return () => {
      this.#widgetListeners.delete(listener);
    };
  };

  selectionModeButton = (): SelectionModeButtonState => this.#overlay.selectionModeButton();

  presentationButtonRect(): QRect {
    return this.#overlay.presentationButtonRect();
  }

  // Scene.

  setRuntimeResult(result: RuntimeResult): void {
    const state = this.#state;
    const build = buildDebugItems(result);
    state.debugItems = build.items;
    this.#view.setDebugSceneScale(build.debugSceneScale);

    const existingNames = new Set(state.debugItems.map((item) => item.name));
    state.hiddenDebugItems = new Set([...state.hiddenDebugItems].filter((name) => existingNames.has(name)));

    this.#view.rebuildAxes();
    this.#rebuildGpuVertices();

    if (!this.#hasFitOnce && state.geometryScene.meshes.length > 0) {
      this.fitScene();
      this.#hasFitOnce = true;
    }

    for (const name of [...state.selectedVariables]) if (!existingNames.has(name)) state.selectedVariables.delete(name);

    this.update();
  }

  setGeometryScene(scene: PreviewGeometryScene): void {
    const state = this.#state;
    this.#pickers.invalidate();
    state.selectedMeshIndex = -1;
    state.meshFocusActive = false;
    state.geometryScene = { meshes: [...scene.meshes], warnings: [...scene.warnings] };
    this.#scene.geometryChanged();
    this.#view.setGeometryScene(state.geometryScene);
    this.#afterCameraMove();
  }

  setShowGeometry(visible: boolean): void {
    if (this.#state.showGeometry === visible) return;
    this.#state.showGeometry = visible;
    this.#input.clearHover();
    this.update();
  }

  setGeometryWireframe(wireframe: boolean): void {
    if (this.#state.geometryWireframe === wireframe) return;
    this.#state.geometryWireframe = wireframe;
    this.update();
  }

  setConnectorPreviews(connectors: readonly ConnectorPreview[], selectedId: number): void {
    this.#state.connectors = [...connectors];
    this.#state.selectedConnectorId = selectedId;
    this.#view.setConnectors(this.#state.connectors);
    this.#afterCameraMove();
  }

  // API and mesh selection.

  setSelectedApiCall(apiIndex: number, keepMeshSelection = false): void {
    const state = this.#state;
    state.meshFocusActive = keepMeshSelection && state.selectedMeshIndex >= 0;
    if (!state.meshFocusActive) state.selectedMeshIndex = -1;
    state.selectedApiIndex = apiIndex;
    this.update();
  }

  selectedMeshIndex(): number {
    return this.#state.selectedMeshIndex;
  }

  isMeshSelected(meshIndex: number): boolean {
    return this.#state.isMeshSelected(meshIndex);
  }

  hasApiFocus(): boolean {
    return this.#state.apiFocusActive;
  }

  hasMeshFocus(): boolean {
    return this.#state.meshFocusActive;
  }

  setApiFocusIndices(indices: ReadonlySet<number>, debugIndices: ReadonlySet<number> = indices): void {
    this.#state.apiFocusActive = true;
    this.#state.apiFocusIndices = new Set(indices);
    this.#state.debugFocusIndices = new Set(debugIndices);
    this.#afterCameraMove();
  }

  clearApiFocus(): void {
    const state = this.#state;
    if (!state.apiFocusActive && state.apiFocusIndices.size === 0) return;
    state.apiFocusActive = false;
    state.apiFocusIndices.clear();
    state.debugFocusIndices.clear();
    this.#afterCameraMove();
  }

  fitScene(): void {
    this.#view.fitScene();
    this.#afterCameraMove();
  }

  fitDebugOverlay(): void {
    this.#view.fitDebugOverlay();
    this.#afterCameraMove();
  }

  // Debug points and vectors.

  setShowPoints(visible: boolean): void {
    if (this.#state.showPoints === visible) return;
    this.#state.showPoints = visible;
    this.#rebuildAndUpdate();
  }

  setShowVectors(visible: boolean): void {
    if (this.#state.showVectors === visible) return;
    this.#state.showVectors = visible;
    this.#rebuildAndUpdate();
  }

  setShowLabels(visible: boolean): void {
    this.#state.showLabels = visible;
    this.#overlay.updateLabelPanels(this.#surface.width, this.#surface.height);
    this.update();
  }

  setDebugItemVisible(name: string, visible: boolean): void {
    if (name === '') return;
    if (visible) this.#state.hiddenDebugItems.delete(name);
    else this.#state.hiddenDebugItems.add(name);
    this.#rebuildAndUpdate();
  }

  hideAllDebugItems(): void {
    const hidden = new Set(this.#state.debugItems.map((item) => item.name));
    if (setsEqual(hidden, this.#state.hiddenDebugItems)) return;
    this.#state.hiddenDebugItems = hidden;
    this.#rebuildAndUpdate();
  }

  showAllDebugItems(): void {
    if (this.#state.hiddenDebugItems.size === 0) return;
    this.#state.hiddenDebugItems.clear();
    this.#rebuildAndUpdate();
  }

  setSelectedVariable(name: string): void {
    this.setSelectedVariables(name === '' ? new Set<string>() : new Set<string>([name]));
  }

  setSelectedVariables(names: ReadonlySet<string>): void {
    const ids = new Set(names);
    ids.delete('');
    if (setsEqual(this.#state.selectedVariables, ids)) return;
    this.#state.selectedVariables = ids;
    this.#rebuildAndUpdate();
  }

  selectedDebugItems(): Set<string> {
    return new Set(this.#state.selectedVariables);
  }

  // Callbacks.

  setSelectionChangedCallback(callback: ((names: Set<string>) => void) | null): void {
    this.#callbacks.selectionChanged = callback;
  }

  setMeshSelectionCallback(callback: ((apiIndex: number, sourceLine: number) => void) | null): void {
    this.#callbacks.meshSelection = callback;
  }

  setPointCreationCallback(callback: ((point: Vec3) => void) | null): void {
    this.#callbacks.pointCreation = callback;
  }

  setConnectorSelectionCallback(callback: ((id: number) => void) | null): void {
    this.#callbacks.connectorSelection = callback;
  }

  // Accessors.

  width(): number {
    return this.#surface.width;
  }

  height(): number {
    return this.#surface.height;
  }

  camera(): ViewportCamera {
    return this.#view.camera;
  }

  sceneScale(): number {
    return this.#view.sceneScale;
  }

  pointLabelPanel(): DebugLabelPanel {
    return this.#overlay.pointLabels;
  }

  vectorLabelPanel(): DebugLabelPanel {
    return this.#overlay.vectorLabels;
  }

  // Surface lifecycle.

  attach(surface: ViewportSurface): void {
    this.#surface.attach(surface);
  }

  detach(): void {
    this.#surface.detach();
  }

  setTextMeasurer(measurer: TextMeasurer): void {
    this.#overlay.setTextMeasurer(measurer);
  }

  resize(width: number, height: number, devicePixelRatio = 1): void {
    this.#surface.resize(width, height, devicePixelRatio);
  }

  update(): void {
    this.#surface.update();
  }

  // Input.

  mousePressEvent(event: MouseEventData): void {
    this.#input.press(event);
  }

  mouseMoveEvent(event: MouseEventData): void {
    this.#input.move(event);
  }

  mouseReleaseEvent(event: MouseEventData): void {
    this.#input.release(event);
  }

  wheelEvent(event: WheelEventData): void {
    this.#input.wheel(event);
  }

  leaveEvent(): void {
    this.#input.clearHover();
  }

  eventFilter(event: 'Enter' | 'FocusIn'): void {
    if (event === 'Enter' || event === 'FocusIn') this.#input.clearHover();
  }

  #inputHost(): InputHost {
    return {
      callbacks: this.#callbacks,
      bounds: (): QRect => this.#surface.bounds(),
      update: () => this.update(),
      setCursor: (cursor) => this.#surface.setCursor(cursor),
      rebuild: (axes) => {
        if (axes) this.#view.rebuildAxes();
        this.#rebuildGpuVertices();
      },
      selectDebugItems: (names) => {
        this.setSelectedVariables(names);
        this.#selectionChanged();
      },
      setSelectedVariables: (names) => this.setSelectedVariables(names),
    };
  }

  // The camera or scene scale changed: the axes, then the vertices, are rebuilt.
  #afterCameraMove(): void {
    this.#view.rebuildAxes();
    this.#rebuildAndUpdate();
  }

  #rebuildAndUpdate(): void {
    this.#rebuildGpuVertices();
    this.update();
  }

  #rebuildGpuVertices(): void {
    this.#input.clearHover();
    this.#scene.rebuild();
    this.#overlay.updateLabelPanels(this.#surface.width, this.#surface.height);
  }

  #updateSelectionModeButton(): void {
    this.#overlay.setSelectionModeButton({ text: kSelectionModeNames[this.#state.selectionMode] });
  }

  #selectionChanged(): void {
    this.#callbacks.selectionChanged?.(new Set(this.#state.selectedVariables));
  }

  #notifyWidgets(): void {
    for (const listener of [...this.#widgetListeners]) listener();
  }
}

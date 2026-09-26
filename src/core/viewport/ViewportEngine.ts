import { LeftButton, NoButton, NoModifier, RightButton } from '../../helpers/qtInput';
import type { KeyboardModifiers, MouseEventData, WheelEventData } from '../../types/input';
import type { FontSpec, TextMeasurer } from '../../types/text';
import type { Vec3 } from '../../types/viewport';
import type {
  AxisLabel,
  DebugKind,
  DebugLabelEntry,
  GeometryRange,
  GpuVertexLayout,
  SelectionMode,
  SelectionModeButtonState,
  ViewportSurface,
} from '../../types/viewportEngine';
import { Bounds3D } from '../../utils/Bounds3D';
import { CanvasTextMeasurer } from '../../utils/CanvasTextMeasurer';
import { QMatrix4x4 } from '../../utils/Matrix4x4';
import { qColor } from '../../utils/painting';
import { QRect, QRectF } from '../../utils/Rect';
import { setsEqual } from '../../utils/sets';
import {
  approximateTextMeasurer,
  fontWithPointSize,
  kDefaultFontFamily,
  pointSizeToPixels,
} from '../../utils/textMetrics';
import { QPoint, QPointF, QVector3D } from '../../utils/Vector3D';
import type { ConnectorPreview } from '../geometry/ConnectorPreview';
import type { PreviewGeometryScene } from '../geometry/PreviewGeometryEngine';
import type { RuntimeResult } from '../runtime/RuntimeTypes';
import { appendConnectorVertices, connectorSceneScale, connectorTip, drawConnectorPoints } from './connectorOverlay';
import { DebugLabelPanel } from './DebugLabelPanel';
import type { DebugItem } from './DebugItem';
import { appendVectorArrow, buildDebugItems, kOverviewPointName } from './debugItems';
import { drawDebugItems, drawPreselection, type DebugOverlayScene } from './debugOverlay';
import { buildGeometryVertices, buildGeometryWireVertices } from './geometryVertices';
import { OverlayPainter } from './OverlayPainter';
import { debugLabelPanelsLayout } from './panelLayout';
import { pickConnectorAt, pickDebugItemsAt, pickMeshesAlongRay } from './picking';
import { VertexArray } from './VertexArray';
import { ViewportCamera } from './ViewportCamera';
import { ViewportRenderer } from './ViewportRenderer';
import { axesVertices, drawWorldAxisLabels, placeWorldAxisLabels } from './worldAxes';

const kSelectionModeNames: Record<SelectionMode, string> = { Point: 'Point', Vector: 'Vector', Mesh: 'Mesh' };
const kNextSelectionMode: Record<SelectionMode, SelectionMode> = { Point: 'Vector', Vector: 'Mesh', Mesh: 'Point' };
const kClickDragThreshold = 5;

interface GeometryVertexCache {
  version: number;
  triangles: Float32Array;
  triangleRanges: GeometryRange[];
  wires: Float32Array;
  wireRanges: GeometryRange[];
}

export class ViewportEngine {
  private readonly m_renderer = new ViewportRenderer();
  private readonly m_camera = new ViewportCamera();
  private m_gl: WebGL2RenderingContext | null = null;

  private m_axesVertices = new VertexArray();
  private m_gpuVertices = new VertexArray(4096);
  private m_gpuLayout: GpuVertexLayout = {
    axesVertexCount: 0,
    geometryWireVertexStart: 0,
    geometryWireVertexCount: 0,
    vectorVertexStart: 0,
    connectorVertexStart: 0,
    connectorLineStart: 0,
    connectorLineCount: 0,
  };
  private m_debugItems: DebugItem[] = [];
  private readonly m_pointLabels = new DebugLabelPanel('Points', qColor(255, 174, 52));
  private readonly m_vectorLabels = new DebugLabelPanel('Vectors', qColor(51, 199, 255));
  private m_selectionModeButton: SelectionModeButtonState = { text: '', geometry: new QRect() };
  private m_selectionMode: SelectionMode = 'Point';
  private m_selectionPresentation: 'Separate' | 'Unite' = 'Separate';
  private m_lastPick: { screen: QPointF; candidates: string; index: number } | null = null;

  selectionPresentation = (): 'Separate' | 'Unite' => this.m_selectionPresentation;

  toggleSelectionPresentation(): void {
    this.m_selectionPresentation = this.m_selectionPresentation === 'Separate' ? 'Unite' : 'Separate';
    this.m_lastPick = null;
    this.clearHover();
    this.rebuildGpuVertices();
    for (const listener of this.m_widgetListeners) listener();
    this.update();
  }

  private m_hoveredDebugItem = '';
  private m_hoveredMeshIndex = -1;
  private m_geometryScene: PreviewGeometryScene = { meshes: [], warnings: [] };
  private m_geometryRanges: GeometryRange[] = [];
  private m_geometryWireRanges: GeometryRange[] = [];
  private m_connectors: ConnectorPreview[] = [];
  private m_selectedConnectorId = -1;
  private m_hoveredConnectorId = -1;
  private m_connectorVertexStart = 0;
  private m_connectorVertexCount = 0;
  private m_connectorLineStart = 0;
  private m_connectorLineCount = 0;
  private m_connectorSceneScale = 0;
  private m_connectorSelectionCallback: ((id: number) => void) | null = null;

  private m_axesVertexCount = 0;
  private m_vectorVertexStart = 0;
  private m_vectorVertexCount = 0;
  private m_selectedVectorVertexStart = 0;
  private m_selectedVectorVertexCount = 0;

  private m_lastMousePosition = new QPoint();
  private m_dragDistance = 0;
  private m_pressModifiers: KeyboardModifiers = NoModifier;

  private m_gpuDirty = true;
  private m_showPoints = true;
  private m_showVectors = true;
  private m_showLabels = true;
  private m_showGeometry = true;
  private m_geometryWireframe = false;
  private m_hasFitOnce = false;

  private m_debugSceneScale = 10;
  private m_geometrySceneScale = 10;
  private m_sceneScale = 10;
  private m_selectedVariables = new Set<string>();
  private m_selectedApiIndex = -1;
  private m_selectedMeshIndex = -1;
  private m_meshFocusActive = false;
  private m_apiFocusActive = false;
  private m_apiFocusIndices = new Set<number>();
  private m_debugFocusIndices = new Set<number>();
  private m_hiddenDebugItems = new Set<string>();

  private m_selectionChangedCallback: ((names: Set<string>) => void) | null = null;
  private m_pointCreationCallback: ((point: Vec3) => void) | null = null;
  private m_meshSelectionCallback: ((apiIndex: number, sourceLine: number) => void) | null = null;

  private m_surface: ViewportSurface | null = null;
  private m_overlayContext: CanvasRenderingContext2D | null = null;
  private m_measurer: TextMeasurer = approximateTextMeasurer;
  private m_fontFamily = kDefaultFontFamily;
  private m_fontPixelSize = pointSizeToPixels(9);
  private m_width = 0;
  private m_height = 0;
  private m_devicePixelRatio = 1;
  private m_updateFrame: number | null = null;
  private m_cursor = '';
  private readonly m_widgetListeners = new Set<() => void>();

  private m_geometryCache: GeometryVertexCache | null = null;
  private m_geometryVersion = 0;

  constructor() {
    this.updateSelectionModeButton();
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) {
      panel.setParentUpdate(() => this.update());
      panel.setActivatedCallback((ids, additive) => {
        const selected = additive ? new Set(this.m_selectedVariables) : new Set<string>();
        for (const id of panel.itemIds()) selected.delete(id);
        for (const id of ids) selected.add(id);
        this.setSelectedVariables(selected);
        if (this.m_selectionChangedCallback) this.m_selectionChangedCallback(new Set(this.m_selectedVariables));
      });
    }
    this.buildAxesVertices();
    this.layoutDebugLabelPanels();
  }

  selectionModeButtonClicked(): void {
    this.m_lastPick = null;
    this.m_selectionMode = kNextSelectionMode[this.m_selectionMode];
    this.clearHover();
    this.updateSelectionModeButton();
    this.layoutDebugLabelPanels();
  }

  setRuntimeResult(result: RuntimeResult): void {
    this.rebuildDebugItems(result);

    const existingNames = new Set<string>();
    for (const item of this.m_debugItems) existingNames.add(item.name);
    const stillHidden = new Set<string>();
    for (const name of this.m_hiddenDebugItems) {
      if (existingNames.has(name)) stillHidden.add(name);
    }
    this.m_hiddenDebugItems = stillHidden;

    this.buildAxesVertices();
    this.rebuildGpuVertices();

    if (!this.m_hasFitOnce && this.m_geometryScene.meshes.length > 0) {
      this.fitScene();
      this.m_hasFitOnce = true;
    }

    for (const name of [...this.m_selectedVariables]) {
      if (!existingNames.has(name)) this.m_selectedVariables.delete(name);
    }

    this.update();
  }

  setGeometryScene(scene: PreviewGeometryScene): void {
    this.m_lastPick = null;
    this.m_selectedMeshIndex = -1;
    this.m_meshFocusActive = false;
    this.m_geometryScene = { meshes: [...scene.meshes], warnings: [...scene.warnings] };
    this.m_geometryCache = null;
    ++this.m_geometryVersion;
    this.m_geometrySceneScale = 10;
    for (const mesh of this.m_geometryScene.meshes) {
      for (const v of mesh.vertices) {
        this.m_geometrySceneScale = Math.max(this.m_geometrySceneScale, Math.hypot(v.x, v.y, v.z));
      }
    }
    this.updateCombinedSceneScale();
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  setShowGeometry(visible: boolean): void {
    if (this.m_showGeometry === visible) return;
    this.m_showGeometry = visible;
    this.clearHover();
    this.update();
  }

  setGeometryWireframe(wireframe: boolean): void {
    if (this.m_geometryWireframe === wireframe) return;
    this.m_geometryWireframe = wireframe;
    this.update();
  }

  setConnectorPreviews(connectors: readonly ConnectorPreview[], selectedId: number): void {
    this.m_connectors = [...connectors];
    this.m_selectedConnectorId = selectedId;
    this.m_connectorSceneScale = connectorSceneScale(this.m_connectors);
    this.updateCombinedSceneScale();
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  setConnectorSelectionCallback(callback: ((id: number) => void) | null): void {
    this.m_connectorSelectionCallback = callback;
  }

  setSelectedApiCall(apiIndex: number, keepMeshSelection = false): void {
    this.m_meshFocusActive = keepMeshSelection && this.m_selectedMeshIndex >= 0;
    if (!this.m_meshFocusActive) this.m_selectedMeshIndex = -1;
    this.m_selectedApiIndex = apiIndex;
    this.update();
  }

  selectedMeshIndex(): number {
    return this.m_selectedMeshIndex;
  }

  isMeshSelected(meshIndex: number): boolean {
    return this.isMeshInGroup(meshIndex, this.m_selectedMeshIndex);
  }

  hasApiFocus(): boolean {
    return this.m_apiFocusActive;
  }

  hasMeshFocus(): boolean {
    return this.m_meshFocusActive;
  }

  setApiFocusIndices(indices: ReadonlySet<number>, debugIndices: ReadonlySet<number> = indices): void {
    this.m_apiFocusActive = true;
    this.m_apiFocusIndices = new Set(indices);
    this.m_debugFocusIndices = new Set(debugIndices);
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  clearApiFocus(): void {
    if (!this.m_apiFocusActive && this.m_apiFocusIndices.size === 0) return;
    this.m_apiFocusActive = false;
    this.m_apiFocusIndices.clear();
    this.m_debugFocusIndices.clear();
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  fitScene(): void {
    const bounds = new Bounds3D();
    if (this.m_showGeometry) {
      for (const mesh of this.m_geometryScene.meshes) {
        if (!this.isGeometryApiVisible(mesh.apiIndex)) continue;
        for (const v of mesh.vertices) bounds.addPoint(v);
      }
    }
    this.addVisibleDebugItems(bounds);
    if (!this.m_apiFocusActive) {
      for (const connector of this.m_connectors) {
        for (const mesh of connector.meshes) for (const v of mesh.vertices) bounds.addPoint(v);
        bounds.addPoint(connectorTip(connector));
      }
    }
    if (bounds.isEmpty()) {
      this.fitDebugOverlay();

      return;
    }
    this.fitBounds(bounds);
  }

  setShowPoints(visible: boolean): void {
    if (this.m_showPoints === visible) return;
    this.m_showPoints = visible;
    this.rebuildGpuVertices();
    this.update();
  }

  setShowVectors(visible: boolean): void {
    if (this.m_showVectors === visible) return;
    this.m_showVectors = visible;
    this.rebuildGpuVertices();
    this.update();
  }

  setShowLabels(visible: boolean): void {
    this.m_showLabels = visible;
    this.updateDebugLabelPanels();
    this.update();
  }

  setDebugItemVisible(name: string, visible: boolean): void {
    if (name === '') return;
    if (visible) this.m_hiddenDebugItems.delete(name);
    else this.m_hiddenDebugItems.add(name);
    this.rebuildGpuVertices();
    this.update();
  }

  hideAllDebugItems(): void {
    const hidden = new Set<string>();
    for (const item of this.m_debugItems) hidden.add(item.name);

    if (setsEqual(hidden, this.m_hiddenDebugItems)) return;
    this.m_hiddenDebugItems = hidden;
    this.rebuildGpuVertices();
    this.update();
  }

  showAllDebugItems(): void {
    if (this.m_hiddenDebugItems.size === 0) return;
    this.m_hiddenDebugItems.clear();
    this.rebuildGpuVertices();
    this.update();
  }

  setSelectedVariable(name: string): void {
    this.setSelectedVariables(name === '' ? new Set<string>() : new Set<string>([name]));
  }

  setSelectedVariables(names: ReadonlySet<string>): void {
    const ids = new Set(names);
    ids.delete('');
    if (setsEqual(this.m_selectedVariables, ids)) return;
    this.m_selectedVariables = ids;
    this.rebuildGpuVertices();
    this.update();
  }

  selectedDebugItems(): Set<string> {
    return new Set(this.m_selectedVariables);
  }

  fitDebugOverlay(): void {
    const bounds = new Bounds3D();
    this.addVisibleDebugItems(bounds);
    if (bounds.isEmpty()) {
      this.m_camera.reset();
      this.buildAxesVertices();
      this.rebuildGpuVertices();
      this.update();

      return;
    }
    this.fitBounds(bounds);
  }

  setSelectionChangedCallback(callback: ((names: Set<string>) => void) | null): void {
    this.m_selectionChangedCallback = callback;
  }

  setMeshSelectionCallback(callback: ((apiIndex: number, sourceLine: number) => void) | null): void {
    this.m_meshSelectionCallback = callback;
  }

  setPointCreationCallback(callback: ((point: Vec3) => void) | null): void {
    this.m_pointCreationCallback = callback;
  }

  width(): number {
    return this.m_width;
  }

  height(): number {
    return this.m_height;
  }

  camera(): ViewportCamera {
    return this.m_camera;
  }

  sceneScale(): number {
    return this.m_sceneScale;
  }

  pointLabelPanel(): DebugLabelPanel {
    return this.m_pointLabels;
  }

  vectorLabelPanel(): DebugLabelPanel {
    return this.m_vectorLabels;
  }

  attach(surface: ViewportSurface): void {
    if (this.m_surface) this.detach();
    this.m_surface = surface;
    this.m_fontFamily = surface.fontFamily || kDefaultFontFamily;
    this.m_fontPixelSize = surface.fontPixelSize > 0 ? surface.fontPixelSize : pointSizeToPixels(9);
    this.m_overlayContext = surface.overlay.getContext('2d');
    this.m_measurer = CanvasTextMeasurer.create() ?? approximateTextMeasurer;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) {
      panel.setFontFamily(this.m_fontFamily);
      panel.setTextMeasurer(this.m_measurer);
    }
    surface.glCanvas.addEventListener('webglcontextlost', this.onContextLost);
    surface.glCanvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.m_gl = surface.glCanvas.getContext('webgl2', {
      antialias: true,
      depth: true,
      stencil: false,
      alpha: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!this.m_gl) console.warn('Viewport3D: WebGL2 is not available; only the overlay is drawn.');
    else if (!this.m_gl.isContextLost()) this.initializeGL();
    this.applyCanvasSize();
    this.setCursor(this.m_cursor);
    this.layoutDebugLabelPanels();
    this.update();
  }

  detach(): void {
    const surface = this.m_surface;
    if (!surface) return;
    if (this.m_updateFrame !== null && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(this.m_updateFrame);
    this.m_updateFrame = null;
    surface.glCanvas.removeEventListener('webglcontextlost', this.onContextLost);
    surface.glCanvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.m_renderer.release(this.m_gl !== null && !this.m_gl.isContextLost());
    this.m_gl = null;
    this.m_overlayContext = null;
    this.m_surface = null;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) panel.dispose();
  }

  setTextMeasurer(measurer: TextMeasurer): void {
    this.m_measurer = measurer;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) panel.setTextMeasurer(measurer);
  }

  resize(width: number, height: number, devicePixelRatio = 1): void {
    this.m_width = Math.max(0, Math.round(width));
    this.m_height = Math.max(0, Math.round(height));
    this.m_devicePixelRatio = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
    this.m_camera.setViewportSize(this.m_width, this.m_height);
    this.applyCanvasSize();
    this.resizeGL();
    this.resizeEvent();
    this.paintNow();
  }

  update(): void {
    if (!this.m_surface || this.m_updateFrame !== null || typeof requestAnimationFrame !== 'function') return;
    this.m_updateFrame = requestAnimationFrame(() => {
      this.m_updateFrame = null;
      this.paintNow();
    });
  }

  subscribeWidgets = (listener: () => void): (() => void) => {
    this.m_widgetListeners.add(listener);

    return () => {
      this.m_widgetListeners.delete(listener);
    };
  };

  selectionModeButton = (): SelectionModeButtonState => this.m_selectionModeButton;

  mousePressEvent(event: MouseEventData): void {
    this.clearHover();
    this.m_lastMousePosition = new QPointF(event.x, event.y).toPoint();
    this.m_pressModifiers = event.modifiers;
    this.m_dragDistance = 0;
  }

  mouseMoveEvent(event: MouseEventData): void {
    const position = new QPointF(event.x, event.y);
    const currentPosition = position.toPoint();
    const delta = currentPosition.sub(this.m_lastMousePosition);
    this.m_lastMousePosition = currentPosition;
    if (event.buttons === NoButton) {
      this.updateHover(position);

      return;
    }
    this.clearHover();
    this.m_dragDistance += delta.manhattanLength();
    if (this.m_dragDistance < kClickDragThreshold) return;
    this.m_lastPick = null;

    const creatingPoint = this.m_selectionMode === 'Point' && this.m_pressModifiers.control;
    if (event.buttons & LeftButton && !creatingPoint) {
      this.m_camera.orbit(delta);
      this.rebuildGpuVertices();
      this.update();
    }

    if (event.buttons & RightButton) {
      this.m_camera.pan(delta);
      this.buildAxesVertices();
      this.rebuildGpuVertices();
      this.update();
    }
  }

  mouseReleaseEvent(event: MouseEventData): void {
    const position = new QPointF(event.x, event.y);
    if (event.button === LeftButton && this.m_dragDistance < kClickDragThreshold) this.click(position);
    if (this.rect().contains(position.toPoint())) this.updateHover(position);
  }

  wheelEvent(event: WheelEventData): void {
    this.m_lastPick = null;
    this.m_camera.zoom(event.angleDeltaY);
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.updateHover(new QPointF(event.x, event.y));
    this.update();
  }

  leaveEvent(): void {
    this.clearHover();
  }

  eventFilter(event: 'Enter' | 'FocusIn'): void {
    if (event === 'Enter' || event === 'FocusIn') this.clearHover();
  }

  private click(position: QPointF): void {
    this.updateViewMatrix();
    this.updateProjectionMatrix();
    const connectorId = this.m_selectionMode === 'Point' ? this.pickConnectorPoint(position) : -1;
    if (connectorId >= 0 && !this.m_pressModifiers.control) {
      if (this.m_connectorSelectionCallback) this.m_connectorSelectionCallback(connectorId);
    } else if (this.m_selectionMode === 'Point' && this.m_pressModifiers.control) {
      const point = this.m_camera.screenToGroundPlane(position);
      if (point && this.m_pointCreationCallback) this.m_pointCreationCallback({ x: point.x, y: point.y, z: point.z });
    } else if (this.m_selectionMode !== 'Mesh') {
      const name = this.pickDebugItem(position, this.m_selectionMode === 'Point' ? 'Point' : 'Vector', true);
      if (name === '') return;
      const selected = this.m_pressModifiers.shift ? new Set(this.m_selectedVariables) : new Set<string>();
      if (selected.has(name)) selected.delete(name);
      else selected.add(name);
      this.setSelectedVariables(selected);
      if (this.m_selectionChangedCallback) this.m_selectionChangedCallback(new Set(this.m_selectedVariables));
    } else {
      const meshIndex = this.pickMesh(position, true);
      if (meshIndex < 0) return;
      this.m_selectedMeshIndex = meshIndex;
      this.setSelectedVariables(new Set());
      const mesh = this.m_geometryScene.meshes[meshIndex];
      if (this.m_meshSelectionCallback) this.m_meshSelectionCallback(mesh.apiIndex, mesh.sourceLine);
      this.update();
    }
  }

  private rect(): QRect {
    return new QRect(0, 0, this.m_width, this.m_height);
  }

  private isMeshInGroup(meshIndex: number, pickedIndex: number): boolean {
    const count = this.m_geometryScene.meshes.length;
    if (pickedIndex < 0 || pickedIndex >= count || meshIndex < 0 || meshIndex >= count) return false;
    const apiIndex = this.m_geometryScene.meshes[pickedIndex].apiIndex;

    return apiIndex >= 0 ? this.m_geometryScene.meshes[meshIndex].apiIndex === apiIndex : meshIndex === pickedIndex;
  }

  private addVisibleDebugItems(bounds: Bounds3D): void {
    for (const item of this.m_debugItems) {
      if (!this.isDebugItemVisible(item)) continue;
      if (item.kind === 'Point') {
        bounds.addPoint(item.end);
      } else {
        bounds.addPoint(item.start);
        bounds.addPoint(item.end);
      }
    }
  }

  private fitBounds(bounds: Bounds3D): void {
    this.m_camera.fitBounds(bounds.minimum(), bounds.maximum());
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  private applyCanvasSize(): void {
    const surface = this.m_surface;
    if (!surface) return;
    const w = Math.max(1, Math.round(this.m_width * this.m_devicePixelRatio));
    const h = Math.max(1, Math.round(this.m_height * this.m_devicePixelRatio));
    for (const canvas of [surface.glCanvas, surface.overlay]) {
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    }
  }

  private paintNow(): void {
    if (!this.m_surface || this.m_width <= 0 || this.m_height <= 0) return;
    this.paintGL();
  }

  private setCursor(cursor: string): void {
    this.m_cursor = cursor;
    if (this.m_surface && this.m_surface.cursorElement.style.cursor !== cursor)
      this.m_surface.cursorElement.style.cursor = cursor;
  }

  private setSelectionModeButton(state: Partial<SelectionModeButtonState>): void {
    const next = { ...this.m_selectionModeButton, ...state };
    const g = next.geometry;
    const o = this.m_selectionModeButton.geometry;
    if (
      next.text === this.m_selectionModeButton.text &&
      g.x === o.x &&
      g.y === o.y &&
      g.width === o.width &&
      g.height === o.height
    )
      return;
    this.m_selectionModeButton = next;
    for (const listener of [...this.m_widgetListeners]) listener();
  }

  private childAt(p: QPoint): boolean {
    if (this.m_selectionModeButton.geometry.contains(p)) return true;
    if (this.presentationButtonRect().contains(p)) return true;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) {
      if (panel.isVisible() && panel.geometry().contains(p)) return true;
    }

    return false;
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.m_renderer.release(false);
  };

  private onContextRestored = (): void => {
    if (!this.m_gl || this.m_gl.isContextLost()) return;
    this.initializeGL();
    this.update();
  };

  private widgetFont(): FontSpec {
    return { family: this.m_fontFamily, pixelSize: this.m_fontPixelSize, bold: false };
  }

  private axisLabelFont(): FontSpec {
    return fontWithPointSize(this.m_fontFamily, 9, true);
  }

  private initializeGL(): void {
    if (!this.m_gl || !this.m_renderer.initialize(this.m_gl)) return;
    if (this.m_gpuVertices.empty()) this.rebuildGpuVertices();
    this.uploadVertexData();
    this.m_gpuDirty = false;
    this.updateViewMatrix();
  }

  private resizeGL(): void {
    this.updateProjectionMatrix();
  }

  private updateViewMatrix(): void {
    this.m_camera.updateViewMatrix();
  }

  private updateProjectionMatrix(): void {
    this.m_camera.updateProjectionMatrix(this.m_sceneScale);
  }

  private paintGL(): void {
    const renderer = this.m_renderer;
    const glActive = renderer.beginFrame();

    this.updateViewMatrix();
    this.updateProjectionMatrix();

    if (glActive) {
      if (this.m_gpuDirty) this.uploadVertexData();

      const model = new QMatrix4x4();
      model.setToIdentity();
      renderer.setMatrices(this.m_camera.viewProjection().times(model), this.m_camera.view.normalMatrix());

      renderer.setUniformValue('uUseOverrideColor', false);
      renderer.setUniformValue('uLightingEnabled', false);

      renderer.glLineWidth(1.0);
      if (this.m_axesVertexCount > 0) renderer.glDrawArrays('GL_LINES', 0, this.m_axesVertexCount);

      if (this.m_showGeometry && this.m_geometryRanges.length > 0) {
        if (this.m_geometryWireframe) this.drawGeometryWireframe();
        else this.drawGeometrySolid();
        this.drawGeometryHighlight();
        renderer.setDepthMask(true);
        renderer.setDepthTest(true);
      }

      renderer.setUniformValue('uUseOverrideColor', false);
      if (this.m_vectorVertexCount > 0) {
        renderer.glLineWidth(2.0);
        renderer.glDrawArrays('GL_LINES', this.m_vectorVertexStart, this.m_vectorVertexCount);
      }

      if (this.m_selectedVectorVertexCount > 0) {
        renderer.glLineWidth(4.0);
        renderer.glDrawArrays('GL_LINES', this.m_selectedVectorVertexStart, this.m_selectedVectorVertexCount);
      }

      if (!this.m_apiFocusActive && this.m_connectorVertexCount > 0) this.drawConnectors();
      renderer.endFrame();
    }

    this.paintOverlay();
  }

  private drawGeometryWireframe(): void {
    const renderer = this.m_renderer;
    renderer.setDepthTest(false);
    renderer.setDepthMask(false);
    renderer.glLineWidth(1.4);
    for (const range of this.m_geometryWireRanges) {
      if (!this.isGeometryApiVisible(range.apiIndex)) continue;
      renderer.glDrawArrays('GL_LINES', range.start, range.count);
    }
  }

  private drawGeometrySolid(): void {
    const renderer = this.m_renderer;
    const unite = this.m_selectionPresentation === 'Unite';
    if (unite) {
      renderer.setDepthTest(false);
      renderer.setDepthMask(false);
    }
    renderer.setUniformValue('uLightingEnabled', true);
    for (const range of this.m_geometryRanges) {
      if (!this.isGeometryApiVisible(range.apiIndex)) continue;
      const selected = this.isMeshSelected(range.meshIndex);
      const hovered = this.isMeshInGroup(range.meshIndex, this.m_hoveredMeshIndex);
      if (unite) renderer.setOpacity(selected || hovered ? 0.7 : 0.27);
      renderer.setUniformValue('uUseOverrideColor', selected || hovered);
      if (selected) renderer.setUniformValue('uOverrideColor', new QVector3D(0.2, 0.78, 0.95));
      else if (hovered) {
        const color = this.m_geometryScene.meshes[range.meshIndex].color;
        renderer.setUniformValue(
          'uOverrideColor',
          new QVector3D(color.r, color.g, color.b).mul(0.65).add(new QVector3D(0.35, 0.35, 0.35)),
        );
      }
      renderer.glDrawArrays('GL_TRIANGLES', range.start, range.count);
    }
    if (unite) renderer.setOpacity(1);
    renderer.setUniformValue('uLightingEnabled', false);
    renderer.setUniformValue('uUseOverrideColor', false);
  }

  private drawGeometryHighlight(): void {
    if (this.m_selectedApiIndex < 0 && this.m_selectedMeshIndex < 0 && this.m_hoveredMeshIndex < 0) return;
    const renderer = this.m_renderer;
    renderer.setUniformValue('uUseOverrideColor', true);
    renderer.glLineWidth(3.0);
    for (const range of this.m_geometryWireRanges) {
      if (!this.isGeometryApiVisible(range.apiIndex)) continue;
      const selectedDirectly =
        this.m_selectedMeshIndex >= 0
          ? this.isMeshSelected(range.meshIndex)
          : this.m_selectedApiIndex >= 0 && range.apiIndex === this.m_selectedApiIndex;
      const selectedAsHelperChild =
        this.m_selectedMeshIndex < 0 && this.m_apiFocusActive && this.m_apiFocusIndices.has(range.apiIndex);
      const hovered = this.isMeshInGroup(range.meshIndex, this.m_hoveredMeshIndex);
      if (!selectedDirectly && !selectedAsHelperChild && !hovered) continue;
      renderer.setUniformValue(
        'uOverrideColor',
        hovered
          ? new QVector3D(0.7, 0.95, 1.0)
          : this.m_selectedMeshIndex >= 0
            ? new QVector3D(0.82, 1.0, 1.0)
            : new QVector3D(1.0, 0.92, 0.18),
      );
      renderer.glDrawArrays('GL_LINES', range.start, range.count);
    }
    renderer.setUniformValue('uUseOverrideColor', false);
  }

  private drawConnectors(): void {
    const renderer = this.m_renderer;
    renderer.setUniformValue('uUseOverrideColor', false);
    renderer.setUniformValue('uLightingEnabled', true);
    if (!this.m_geometryWireframe)
      renderer.glDrawArrays('GL_TRIANGLES', this.m_connectorVertexStart, this.m_connectorVertexCount);
    renderer.setUniformValue('uLightingEnabled', false);
    renderer.glLineWidth(2.0);
    renderer.setDepthTest(false);
    renderer.setDepthMask(false);
    renderer.glDrawArrays('GL_LINES', this.m_connectorLineStart, this.m_connectorLineCount);
    renderer.setDepthMask(true);
    renderer.setDepthTest(true);
  }

  private paintOverlay(): void {
    const context = this.m_overlayContext;
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.setTransform(this.m_devicePixelRatio, 0, 0, this.m_devicePixelRatio, 0, 0);
    const painter = new OverlayPainter(context, this.m_measurer, this.widgetFont());

    const scene = this.debugOverlayScene();
    drawDebugItems(painter, scene);
    drawPreselection(painter, { ...scene, isVisible: (item) => this.isDebugItemPickable(item) });
    if (!this.m_apiFocusActive)
      drawConnectorPoints(
        painter,
        this.m_connectors,
        this.m_selectedConnectorId,
        this.m_hoveredConnectorId,
        this.m_measurer,
        this.projectToScreen,
      );
    drawWorldAxisLabels(painter, this.worldAxisLabels(), this.axisLabelFont());
  }

  private debugOverlayScene(): DebugOverlayScene {
    return {
      items: this.m_debugItems,
      selected: this.m_selectedVariables,
      hovered: this.m_hoveredDebugItem,
      showLabels: this.m_showLabels,
      isVisible: (item) => this.isDebugItemVisible(item),
      project: this.projectToScreen,
      selectedRowRect: (item) =>
        (item.kind === 'Point' ? this.m_pointLabels : this.m_vectorLabels).selectedRowRect(item.name),
      vectorArrow: (item) => this.vectorArrow(item),
    };
  }

  private buildAxesVertices(): void {
    this.m_axesVertices = axesVertices(this.m_sceneScale, this.m_camera.target, this.m_camera.distance);
  }

  private worldAxisLabels(): AxisLabel[] {
    const occupied: QRectF[] = [];
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) {
      if (panel.isVisible()) occupied.push(QRectF.fromRect(panel.geometry()).adjusted(-4, -4, 4, 4));
    }
    occupied.push(QRectF.fromRect(this.m_selectionModeButton.geometry).adjusted(-4, -4, 4, 4));
    occupied.push(QRectF.fromRect(this.presentationButtonRect()).adjusted(-4, -4, 4, 4));

    return placeWorldAxisLabels({
      axes: this.m_axesVertices,
      transform: this.m_camera.viewProjection(),
      width: this.width(),
      height: this.height(),
      occupied,
      measurer: this.m_measurer,
      font: this.axisLabelFont(),
    });
  }

  private rebuildDebugItems(result: RuntimeResult): void {
    const build = buildDebugItems(result);
    this.m_debugItems = build.items;
    this.m_debugSceneScale = build.debugSceneScale;
    this.updateCombinedSceneScale();
  }

  private updateDebugLabelPanels(): void {
    const points: DebugLabelEntry[] = [];
    const vectors: DebugLabelEntry[] = [];
    const seen = new Set<string>();
    for (const item of this.m_debugItems) {
      if (!this.isDebugItemVisible(item) || seen.has(item.name)) continue;
      seen.add(item.name);
      const entry: DebugLabelEntry = {
        id: item.name,
        name: item.label === '' ? item.name : item.label,
        value: item.valueText,
      };
      (item.kind === 'Point' ? points : vectors).push(entry);
    }
    this.m_pointLabels.setEntries(points, this.m_selectedVariables);
    this.m_vectorLabels.setEntries(vectors, this.m_selectedVariables);
    this.layoutDebugLabelPanels();
  }

  private layoutDebugLabelPanels(): void {
    const layout = debugLabelPanelsLayout({
      extraControlHeight: 38,
      width: this.width(),
      height: this.height(),
      pointContentHeight: this.m_pointLabels.contentHeight(),
      vectorContentHeight: this.m_vectorLabels.contentHeight(),
      showLabels: this.m_showLabels,
      apiFocusActive: this.m_apiFocusActive,
    });
    this.setSelectionModeButton({ geometry: layout.button });
    this.m_pointLabels.setGeometry(layout.point.x, layout.point.y, layout.point.width, layout.point.height);
    this.m_vectorLabels.setGeometry(layout.vector.x, layout.vector.y, layout.vector.width, layout.vector.height);
    this.m_pointLabels.setVisible(layout.pointVisible);
    this.m_vectorLabels.setVisible(layout.vectorVisible);
  }

  private resizeEvent(): void {
    this.clearHover();
    this.layoutDebugLabelPanels();
  }

  private updateSelectionModeButton(): void {
    this.setSelectionModeButton({ text: kSelectionModeNames[this.m_selectionMode] });
  }

  private clearHover(): void {
    if (this.m_hoveredDebugItem === '' && this.m_hoveredMeshIndex < 0 && this.m_hoveredConnectorId < 0) return;
    this.m_hoveredDebugItem = '';
    this.m_hoveredMeshIndex = -1;
    this.m_hoveredConnectorId = -1;
    this.setCursor('');
    this.update();
  }

  private updateHover(screen: QPointF): void {
    if (!this.rect().contains(screen.toPoint()) || this.childAt(screen.toPoint())) {
      this.clearHover();

      return;
    }
    this.updateViewMatrix();
    this.updateProjectionMatrix();
    const connectorId = this.m_selectionMode === 'Point' ? this.pickConnectorPoint(screen) : -1;
    const meshIndex = this.m_selectionMode === 'Mesh' ? this.pickMesh(screen) : -1;
    const debugItem =
      this.m_selectionMode !== 'Mesh' && connectorId < 0
        ? this.pickDebugItem(screen, this.m_selectionMode === 'Point' ? 'Point' : 'Vector')
        : '';
    if (
      debugItem === this.m_hoveredDebugItem &&
      meshIndex === this.m_hoveredMeshIndex &&
      connectorId === this.m_hoveredConnectorId
    )
      return;
    this.m_hoveredDebugItem = debugItem;
    this.m_hoveredMeshIndex = meshIndex;
    this.m_hoveredConnectorId = connectorId;
    this.setCursor(debugItem !== '' || meshIndex >= 0 || connectorId >= 0 ? 'pointer' : '');
    this.update();
  }

  private rebuildGpuVertices(): void {
    this.clearHover();
    this.m_gpuVertices.assign(this.m_axesVertices);
    this.m_axesVertexCount = this.m_axesVertices.size();

    const cache = this.geometryVertexCache();
    this.m_geometryRanges = this.appendCached(cache.triangles, cache.triangleRanges);
    const geometryWireVertexStart = this.m_gpuVertices.size();
    this.m_geometryWireRanges = this.appendCached(cache.wires, cache.wireRanges);
    const geometryWireVertexCount = this.m_gpuVertices.size() - geometryWireVertexStart;

    const eye = this.m_camera.cameraPosition();
    this.m_vectorVertexStart = this.m_gpuVertices.size();
    if (this.m_showVectors) {
      for (const item of this.m_debugItems) {
        if (item.kind !== 'Vector' || this.m_selectedVariables.has(item.name) || !this.isDebugItemVisible(item))
          continue;
        appendVectorArrow(this.m_gpuVertices, item, false, eye, this.m_sceneScale);
      }
    }
    this.m_vectorVertexCount = this.m_gpuVertices.size() - this.m_vectorVertexStart;

    this.m_selectedVectorVertexStart = this.m_gpuVertices.size();
    if (this.m_showVectors) {
      for (const item of this.m_debugItems) {
        if (item.kind !== 'Vector' || !this.m_selectedVariables.has(item.name) || !this.isDebugItemVisible(item))
          continue;
        appendVectorArrow(this.m_gpuVertices, item, true, eye, this.m_sceneScale);
      }
    }
    this.m_selectedVectorVertexCount = this.m_gpuVertices.size() - this.m_selectedVectorVertexStart;

    const connectors = appendConnectorVertices(this.m_gpuVertices, this.m_connectors, this.m_selectedConnectorId);
    this.m_connectorVertexStart = connectors.vertexStart;
    this.m_connectorVertexCount = connectors.vertexCount;
    this.m_connectorLineStart = connectors.lineStart;
    this.m_connectorLineCount = connectors.lineCount;

    this.m_gpuLayout = {
      axesVertexCount: this.m_axesVertexCount,
      geometryWireVertexStart,
      geometryWireVertexCount,
      vectorVertexStart: this.m_vectorVertexStart,
      connectorVertexStart: this.m_connectorVertexStart,
      connectorLineStart: this.m_connectorLineStart,
      connectorLineCount: this.m_connectorLineCount,
    };

    this.updateDebugLabelPanels();
    this.m_gpuDirty = true;
  }

  private uploadVertexData(): void {
    if (this.m_renderer.uploadVertexData(this.m_gpuVertices, this.m_gpuLayout, this.m_geometryVersion))
      this.m_gpuDirty = false;
  }

  private geometryVertexCache(): GeometryVertexCache {
    if (this.m_geometryCache && this.m_geometryCache.version === this.m_geometryVersion) return this.m_geometryCache;
    const triangles = buildGeometryVertices(this.m_geometryScene);
    const wires = buildGeometryWireVertices(this.m_geometryScene);
    this.m_geometryCache = {
      version: this.m_geometryVersion,
      triangles: triangles.vertices.data().slice(),
      triangleRanges: triangles.ranges,
      wires: wires.vertices.data().slice(),
      wireRanges: wires.ranges,
    };

    return this.m_geometryCache;
  }

  private appendCached(vertices: Float32Array, ranges: readonly GeometryRange[]): GeometryRange[] {
    const base = this.m_gpuVertices.size();
    this.m_gpuVertices.appendData(vertices);

    return ranges.map((range) => ({ ...range, start: range.start + base }));
  }

  private vectorArrow(item: DebugItem): VertexArray {
    const arrow = new VertexArray(8);
    appendVectorArrow(arrow, item, false, this.m_camera.cameraPosition(), this.m_sceneScale);

    return arrow;
  }

  private updateCombinedSceneScale(): void {
    this.m_sceneScale = Math.max(10, this.m_debugSceneScale, this.m_geometrySceneScale, this.m_connectorSceneScale);
  }

  private projectToScreen = (world: QVector3D): QPointF | null => this.m_camera.projectToScreen(world);

  private isGeometryApiVisible(apiIndex: number): boolean {
    return (
      this.m_selectionPresentation === 'Unite' ||
      !this.m_apiFocusActive ||
      this.m_apiFocusIndices.size === 0 ||
      this.m_apiFocusIndices.has(apiIndex)
    );
  }

  private cyclePick<T extends string | number>(candidates: T[], screen: QPointF, advance: boolean): T | undefined {
    if (this.m_selectionPresentation !== 'Unite') return candidates[0];
    const signature = `${this.m_selectionMode}:${candidates.join(',')}`;
    const previous = this.m_lastPick;
    const same =
      previous && previous.candidates === signature && screen.sub(previous.screen).toPoint().manhattanLength() < 5;
    const index = same ? (previous.index + (advance ? 1 : 0)) % candidates.length : 0;
    if (advance && candidates.length) this.m_lastPick = { screen, candidates: signature, index };

    return candidates[index];
  }

  presentationButtonRect(): QRect {
    const rect = this.m_selectionModeButton.geometry;

    return new QRect(rect.x, Math.max(0, rect.y - rect.height - 6), rect.width, rect.height);
  }

  private pickMesh(screen: QPointF, advance = false): number {
    if (!this.m_showGeometry) return -1;
    const ray = this.m_camera.screenRay(screen);
    if (!ray) return -1;

    return (
      this.cyclePick(
        pickMeshesAlongRay(this.m_geometryScene.meshes, ray, (apiIndex) => this.isGeometryApiVisible(apiIndex)),
        screen,
        advance,
      ) ?? -1
    );
  }

  private pickDebugItem(screen: QPointF, kind: DebugKind, advance = false): string {
    return (
      this.cyclePick(
        pickDebugItemsAt(
          this.m_debugItems,
          kind,
          screen,
          this.m_camera.cameraPosition(),
          (item) => this.isDebugItemPickable(item),
          this.projectToScreen,
          (item) => this.vectorArrow(item),
        ),
        screen,
        advance,
      ) ?? ''
    );
  }

  private pickConnectorPoint(screen: QPointF): number {
    if (this.m_apiFocusActive) return -1;

    return pickConnectorAt(this.m_connectors, screen, this.projectToScreen);
  }

  private isDebugItemVisible(item: DebugItem): boolean {
    if (this.m_apiFocusActive) {
      if (!item.apiSnapshot) return false;
      if (item.apiIndex < 0 || !this.m_debugFocusIndices.has(item.apiIndex)) return false;
    } else {
      if (item.apiSnapshot || item.name !== kOverviewPointName) return false;
    }

    if (this.m_hiddenDebugItems.has(item.name)) return false;

    if (item.kind === 'Point') return this.m_showPoints;

    return this.m_showVectors;
  }

  private isDebugItemPickable(item: DebugItem): boolean {
    if (this.m_selectionPresentation !== 'Unite') return this.isDebugItemVisible(item);

    // Unite can pick other API calls without displaying all their points and vectors.
    if (!item.apiSnapshot && item.name !== kOverviewPointName) return false;
    if (this.m_hiddenDebugItems.has(item.name)) return false;

    return item.kind === 'Point' ? this.m_showPoints : this.m_showVectors;
  }
}

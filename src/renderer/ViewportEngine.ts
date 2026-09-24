// Port of renderer/Viewport3D.{h,cpp}: the OpenGL viewport.
//
// This class is the framework-free part of the Qt widget, member for member:
// camera, debug items, GPU vertex building, picking, hover, selection mode,
// API focus and Link connector tests. Viewport3D.tsx is the thin React wrapper
// that owns the DOM (WebGL canvas, 2D overlay canvas, label lists and the
// Select button) and forwards resize / mouse / wheel events here.
//
// Qt -> web mapping:
//   QOpenGLWidget (OpenGL 3.3 core, 4x MSAA, depth 24) -> WebGL2 canvas
//     (antialias: true, depth: true); shaders translated to GLSL ES 3.00.
//   initializeGL / resizeGL / paintGL / update()       -> attach / resize /
//     paintGL / requestAnimationFrame. State set before the context exists is
//     kept and uploaded later (m_glReady / m_gpuDirty), including after a
//     WebGL context loss and restore.
//   QPainter overlay                                   -> OverlayPainter on a
//     2D canvas above the WebGL canvas (logical pixels).
//   DebugLabelPanel / QPushButton children             -> DebugLabelPanel
//     models rendered as DOM by the React wrapper.
//   width() / height()                                  -> CSS pixel size.
//   GL_LINES + glLineWidth                              -> screen-space quads
//     (see WideLines.ts); widths stay in framebuffer pixels like glLineWidth.

import {
  connectorOrientations,
  previewOrientationDirection,
  type ConnectorPreview,
} from '../geometry/ConnectorPreview';
import type { PreviewGeometryScene } from '../geometry/PreviewGeometryEngine';
import { apiParameterMetadataForCall } from '../runtime/ApiMetadata';
import { formatGeneral } from '../runtime/CppCompat';
import { resolveDebugPointSnapshots, resolveDebugVectorAnchors } from '../runtime/DebugAnchorResolver';
import type { RuntimeResult } from '../runtime/RuntimeTypes';
import { isPoint } from '../runtime/RuntimeValue';
import { DebugLabelPanel, type DebugLabelEntry } from './DebugLabelPanel';
import { QMatrix4x4 } from './Matrix4x4';
import { OverlayPainter, Qt, qColor, qPen, type QColor } from './OverlayPainter';
import {
  LeftButton,
  NoButton,
  RightButton,
  NoModifier,
  type KeyboardModifiers,
  type MouseEventData,
  type WheelEventData,
} from './QtEvents';
import { QRect, QRectF } from './Rect';
import {
  CanvasTextMeasurer,
  approximateTextMeasurer,
  fontHeight,
  fontHeightF,
  fontWithPointSize,
  horizontalAdvance,
  kDefaultFontFamily,
  pointSizeToPixels,
  type FontSpec,
  type TextMeasurer,
} from './TextMetrics';
import { QPoint, QPointF, QVector3D, QVector4D } from './Vector3D';
import { VertexArray, kVertexBytes, kVertexFloats } from './VertexArray';
import { apiDebugItemId, type Vec3 } from './Viewport3DHandle';
import {
  createProgram,
  expandLineQuads,
  kLineQuadBytes,
  kWideLineFragmentShader,
  kWideLineVertexShader,
} from './WideLines';

const kPi = Math.PI;

/* Adjust the Point / Vector / Mesh button here (sizes are logical pixels). */
const kSelectionButtonWidth = 72;
const kSelectionButtonHeight = 24;
const kSelectionButtonMargin = 8;
export const kSelectionButtonFontSize = 9;
const kOverviewPointName = 'p0';

function radians(degrees: number): number {
  return (degrees * kPi) / 180;
}

/** std::clamp */
function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : hi < value ? hi : value;
}

function distancePointToSegment(p: QPointF, a: QPointF, b: QPointF): number {
  const ab = b.sub(a);
  const denom = ab.x * ab.x + ab.y * ab.y;
  if (denom <= 1e-9) {
    const d = p.sub(a);
    return Math.sqrt(d.x * d.x + d.y * d.y);
  }

  const ap = p.sub(a);
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / denom, 0, 1);
  const closest = a.add(ab.mul(t));
  const d = p.sub(closest);
  return Math.sqrt(d.x * d.x + d.y * d.y);
}

/** QString("(%1, %2, %3)").arg(x, 0, 'g', 7)... for FdPoint3d / FdVector3d. */
export function debugValueText(p: { x: number; y: number; z: number }): string {
  return `(${formatGeneral(p.x, 7)}, ${formatGeneral(p.y, 7)}, ${formatGeneral(p.z, 7)})`;
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export interface GeometryRange {
  meshIndex: number;
  apiIndex: number;
  start: number;
  count: number;
}

export type DebugKind = 'Point' | 'Vector';
export type SelectionMode = 'Point' | 'Vector' | 'Mesh';
const kSelectionModeNames: Record<SelectionMode, string> = { Point: 'Point', Vector: 'Vector', Mesh: 'Mesh' };

export class DebugItem {
  kind: DebugKind = 'Point';
  name = '';
  label = '';
  valueText = '';
  rawValue = new QVector3D();
  start = new QVector3D();
  end = new QVector3D();
  // -1 for p0 in the overview; otherwise identifies the immutable API call snapshot.
  apiIndex = -1;
  apiSnapshot = false;
}

export interface AxisLabel {
  text: string;
  color: QColor;
  anchor: QPointF;
  bounds: QRectF;
}

/** State of the bottom-left QPushButton, rendered by the React wrapper. */
export interface SelectionModeButtonState {
  text: string;
  geometry: QRect;
}

/** DOM surfaces handed over by the React wrapper. */
export interface ViewportSurface {
  glCanvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  /** Element whose cursor follows setCursor()/unsetCursor(). */
  cursorElement: HTMLElement;
  /** The widget font (QWidget::font()): family and pixel size. */
  fontFamily: string;
  fontPixelSize: number;
}

/** Mesh-derived vertices depend only on the scene; they are computed once per scene. */
interface GeometryVertexCache {
  version: number;
  triangles: Float32Array;
  triangleRanges: GeometryRange[];
  wires: Float32Array;
  wireRanges: GeometryRange[];
}

type BoolUniform = 'uUseOverrideColor' | 'uLightingEnabled';

interface MainProgram {
  program: WebGLProgram;
  uMvp: WebGLUniformLocation | null;
  uNormalMatrix: WebGLUniformLocation | null;
  uUseOverrideColor: WebGLUniformLocation | null;
  uOverrideColor: WebGLUniformLocation | null;
  uLightingEnabled: WebGLUniformLocation | null;
}

interface LineProgram {
  program: WebGLProgram;
  uMvp: WebGLUniformLocation | null;
  uViewport: WebGLUniformLocation | null;
  uLineWidth: WebGLUniformLocation | null;
  uUseOverrideColor: WebGLUniformLocation | null;
  uOverrideColor: WebGLUniformLocation | null;
}

interface QuadStream {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
}

export class ViewportEngine {
  // ---- GL objects (QOpenGLShaderProgram, QOpenGLBuffer, QOpenGLVertexArrayObject) ----
  private m_gl: WebGL2RenderingContext | null = null;
  private m_program: MainProgram | null = null;
  private m_vertexBuffer: WebGLBuffer | null = null;
  private m_vao: WebGLVertexArrayObject | null = null;
  private m_lineProgram: LineProgram | null = null;
  private m_wireQuads: QuadStream | null = null;
  private m_dynamicQuads: QuadStream | null = null;

  private m_axesVertices = new VertexArray();
  private m_gpuVertices = new VertexArray(4096);
  private m_debugItems: DebugItem[] = [];
  private readonly m_pointLabels = new DebugLabelPanel('Points', qColor(255, 174, 52));
  private readonly m_vectorLabels = new DebugLabelPanel('Vectors', qColor(51, 199, 255));
  private m_selectionModeButton: SelectionModeButtonState = { text: '', geometry: new QRect() };
  private m_selectionMode: SelectionMode = 'Point';
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

  private m_projection = new QMatrix4x4();
  private m_view = new QMatrix4x4();

  private m_target = new QVector3D(0, 0, 0);
  private m_yaw = -45;
  private m_pitch = 28;
  private m_distance = 18;
  private m_lastMousePosition = new QPoint();
  private m_dragDistance = 0;
  private m_pressModifiers: KeyboardModifiers = NoModifier;

  private m_glReady = false;
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
  private m_vectorDisplayScale = 1;
  private m_selectedVariables = new Set<string>();
  private m_selectedApiIndex = -1;
  private m_selectedMeshIndex = -1;
  private m_meshFocusActive = false;
  private m_apiFocusActive = false;
  private m_apiFocusIndices = new Set<number>();
  private m_hiddenDebugItems = new Set<string>();

  private m_selectionChangedCallback: ((names: Set<string>) => void) | null = null;
  private m_pointCreationCallback: ((point: Vec3) => void) | null = null;
  private m_meshSelectionCallback: ((apiIndex: number, sourceLine: number) => void) | null = null;

  // ---- Web-only state: the widget surface and its GL bookkeeping ----
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
  private m_geometryWireVertexStart = 0;
  private m_geometryWireVertexCount = 0;
  private m_uploaded = { geometryVersion: -1, staticStart: -1, staticEnd: -1, capacity: 0 };
  private m_wireQuadVersion = -1;
  private m_dynamicQuadAxesVertices = 0;
  private m_dynamicQuadVectorVertices = 0;

  // Emulated uniform / fixed-function state (QOpenGLShaderProgram::setUniformValue, glLineWidth).
  private m_mvp = new QMatrix4x4();
  private m_normalMatrix: Float32Array = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  private m_uniformUseOverrideColor = false;
  private m_uniformOverrideColor = new QVector3D();
  private m_uniformLightingEnabled = false;
  private m_lineWidth = 1;

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

  /** The Select button's clicked() slot: cycles Point -> Vector -> Mesh. */
  selectionModeButtonClicked(): void {
    switch (this.m_selectionMode) {
      case 'Point':
        this.m_selectionMode = 'Vector';
        break;
      case 'Vector':
        this.m_selectionMode = 'Mesh';
        break;
      case 'Mesh':
        this.m_selectionMode = 'Point';
        break;
    }
    this.clearHover();
    this.updateSelectionModeButton();
    this.layoutDebugLabelPanels();
  }

  // =====================================================================
  // Public API (Viewport3DHandle)
  // =====================================================================

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
    this.m_connectorSceneScale = 0;
    for (const connector of this.m_connectors) {
      for (const mesh of connector.meshes)
        for (const v of mesh.vertices)
          this.m_connectorSceneScale = Math.max(this.m_connectorSceneScale, Math.hypot(v.x, v.y, v.z));
      const tip = connector.point.add(connector.direction.mul(connector.length * 1.65));
      this.m_connectorSceneScale = Math.max(this.m_connectorSceneScale, Math.hypot(tip.x, tip.y, tip.z));
    }
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

  private isMeshInGroup(meshIndex: number, pickedIndex: number): boolean {
    const count = this.m_geometryScene.meshes.length;
    if (pickedIndex < 0 || pickedIndex >= count || meshIndex < 0 || meshIndex >= count) return false;
    const apiIndex = this.m_geometryScene.meshes[pickedIndex].apiIndex;
    // Use the invocation identity, not the source line: loop iterations can
    // produce different blocks from the same line. Unowned meshes stay separate.
    return apiIndex >= 0 ? this.m_geometryScene.meshes[meshIndex].apiIndex === apiIndex : meshIndex === pickedIndex;
  }

  hasApiFocus(): boolean {
    return this.m_apiFocusActive;
  }

  hasMeshFocus(): boolean {
    return this.m_meshFocusActive;
  }

  setApiFocusIndices(indices: ReadonlySet<number>): void {
    this.m_apiFocusActive = true;
    this.m_apiFocusIndices = new Set(indices);
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  clearApiFocus(): void {
    if (!this.m_apiFocusActive && this.m_apiFocusIndices.size === 0) return;
    this.m_apiFocusActive = false;
    this.m_apiFocusIndices.clear();
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
  }

  fitScene(): void {
    let haveBounds = false;
    let minX = 0,
      minY = 0,
      minZ = 0,
      maxX = 0,
      maxY = 0,
      maxZ = 0;

    const add = (x: number, y: number, z: number) => {
      if (!haveBounds) {
        minX = maxX = x;
        minY = maxY = y;
        minZ = maxZ = z;
        haveBounds = true;
        return;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    };

    if (this.m_showGeometry) {
      for (const mesh of this.m_geometryScene.meshes) {
        if (!this.isGeometryApiVisible(mesh.apiIndex)) continue;
        for (const v of mesh.vertices) add(v.x, v.y, v.z);
      }
    }
    for (const item of this.m_debugItems) {
      if (!this.isDebugItemVisible(item)) continue;
      if (item.kind === 'Point') add(item.end.x, item.end.y, item.end.z);
      else {
        add(item.start.x, item.start.y, item.start.z);
        add(item.end.x, item.end.y, item.end.z);
      }
    }

    if (!this.m_apiFocusActive) {
      for (const connector of this.m_connectors) {
        for (const mesh of connector.meshes) for (const v of mesh.vertices) add(v.x, v.y, v.z);
        const tip = connector.point.add(connector.direction.mul(connector.length * 1.65));
        add(tip.x, tip.y, tip.z);
      }
    }
    if (!haveBounds) {
      this.fitDebugOverlay();
      return;
    }
    this.fitBounds(new QVector3D(minX, minY, minZ), new QVector3D(maxX, maxY, maxZ));
  }

  /** The shared tail of fitScene() and fitDebugOverlay(). */
  private fitBounds(minP: QVector3D, maxP: QVector3D): void {
    const size = maxP.sub(minP);
    this.m_target = minP.add(maxP).mul(0.5);
    const radius = Math.max(1, 0.5 * size.length());
    // Fit distance is intentionally unbounded by the old 2000-unit limit.
    // Large CAD geometry (for example diameter 5000) must still fit.
    const halfFov = radians(45 * 0.5);
    const fitDistance = radius / Math.max(0.05, Math.tan(halfFov));
    this.m_distance = clamp(fitDistance * 1.18 + Math.max(2, radius * 0.05), 0.05, 1.0e8);
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.update();
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
    // Hide each current debug item individually so Show Selected can restore it.
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
    let haveBounds = false;
    let minX = 0,
      minY = 0,
      minZ = 0,
      maxX = 0,
      maxY = 0,
      maxZ = 0;

    const add = (p: QVector3D) => {
      if (!haveBounds) {
        minX = maxX = p.x;
        minY = maxY = p.y;
        minZ = maxZ = p.z;
        haveBounds = true;
        return;
      }
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    };

    for (const item of this.m_debugItems) {
      if (!this.isDebugItemVisible(item)) continue;
      if (item.kind === 'Point') {
        add(item.end);
      } else {
        add(item.start);
        add(item.end);
      }
    }

    if (!haveBounds) {
      this.m_target = new QVector3D(0, 0, 0);
      this.m_distance = 18;
      this.buildAxesVertices();
      this.rebuildGpuVertices();
      this.update();
      return;
    }

    this.fitBounds(new QVector3D(minX, minY, minZ), new QVector3D(maxX, maxY, maxZ));
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

  // =====================================================================
  // Widget surface (QOpenGLWidget plumbing)
  // =====================================================================

  width(): number {
    return this.m_width;
  }
  height(): number {
    return this.m_height;
  }
  private rect(): QRect {
    return new QRect(0, 0, this.m_width, this.m_height);
  }

  /** Called by the React wrapper once its canvases are mounted. */
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
      // QSurfaceFormat: OpenGL 3.3 core, setSamples(4), setDepthBufferSize(24).
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

  /** Called by the React wrapper on unmount; state is kept for a later attach(). */
  detach(): void {
    const surface = this.m_surface;
    if (!surface) return;
    if (this.m_updateFrame !== null && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(this.m_updateFrame);
    this.m_updateFrame = null;
    surface.glCanvas.removeEventListener('webglcontextlost', this.onContextLost);
    surface.glCanvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.releaseGlObjects(this.m_gl !== null && !this.m_gl.isContextLost());
    this.m_glReady = false;
    this.m_gl = null;
    this.m_overlayContext = null;
    this.m_surface = null;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) panel.dispose();
  }

  /** For tests and headless use: the text metrics used by the overlay and lists. */
  setTextMeasurer(measurer: TextMeasurer): void {
    this.m_measurer = measurer;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) panel.setTextMeasurer(measurer);
  }

  /** The widget was resized to width x height logical (CSS) pixels. */
  resize(width: number, height: number, devicePixelRatio = 1): void {
    this.m_width = Math.max(0, Math.round(width));
    this.m_height = Math.max(0, Math.round(height));
    this.m_devicePixelRatio = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
    this.applyCanvasSize();
    this.resizeGL(this.m_width, this.m_height);
    this.resizeEvent();
    // Resizing a canvas clears it: repaint in the same frame.
    this.paintNow();
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

  /** QWidget::update(): schedule one repaint. */
  update(): void {
    if (!this.m_surface || this.m_updateFrame !== null || typeof requestAnimationFrame !== 'function') return;
    this.m_updateFrame = requestAnimationFrame(() => {
      this.m_updateFrame = null;
      this.paintNow();
    });
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

  /** setCursor(Qt::PointingHandCursor) */
  private setPointingHandCursor(): void {
    this.setCursor('pointer');
  }
  private unsetCursor(): void {
    this.setCursor('');
  }

  /** The Points / Vectors lists (child widgets rendered by the React wrapper). */
  pointLabelPanel(): DebugLabelPanel {
    return this.m_pointLabels;
  }
  vectorLabelPanel(): DebugLabelPanel {
    return this.m_vectorLabels;
  }

  subscribeWidgets = (listener: () => void): (() => void) => {
    this.m_widgetListeners.add(listener);
    return () => {
      this.m_widgetListeners.delete(listener);
    };
  };

  selectionModeButton = (): SelectionModeButtonState => this.m_selectionModeButton;

  private setSelectionModeButton(state: Partial<SelectionModeButtonState>): void {
    const next = { ...this.m_selectionModeButton, ...state };
    const g = next.geometry,
      o = this.m_selectionModeButton.geometry;
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

  /** QWidget::childAt(): the label lists and the Select button. */
  private childAt(p: QPoint): boolean {
    if (this.m_selectionModeButton.geometry.contains(p)) return true;
    for (const panel of [this.m_pointLabels, this.m_vectorLabels]) {
      if (panel.isVisible() && panel.geometry().contains(p)) return true;
    }
    return false;
  }

  private onContextLost = (event: Event): void => {
    // Allow the browser to restore the context; everything is re-uploaded then.
    event.preventDefault();
    this.m_glReady = false;
    this.releaseGlObjects(false);
  };

  private onContextRestored = (): void => {
    if (!this.m_gl || this.m_gl.isContextLost()) return;
    this.initializeGL();
    this.update();
  };

  private releaseGlObjects(deleteObjects: boolean): void {
    const gl = this.m_gl;
    if (gl && deleteObjects) {
      if (this.m_vao) gl.deleteVertexArray(this.m_vao);
      if (this.m_vertexBuffer) gl.deleteBuffer(this.m_vertexBuffer);
      if (this.m_program) gl.deleteProgram(this.m_program.program);
      if (this.m_lineProgram) gl.deleteProgram(this.m_lineProgram.program);
      for (const stream of [this.m_wireQuads, this.m_dynamicQuads]) {
        if (!stream) continue;
        gl.deleteVertexArray(stream.vao);
        gl.deleteBuffer(stream.buffer);
      }
    }
    this.m_vao = null;
    this.m_vertexBuffer = null;
    this.m_program = null;
    this.m_lineProgram = null;
    this.m_wireQuads = null;
    this.m_dynamicQuads = null;
    this.m_uploaded = { geometryVersion: -1, staticStart: -1, staticEnd: -1, capacity: 0 };
    this.m_wireQuadVersion = -1;
  }

  /** The widget font with setPointSize(pointSize) / setBold(bold). */
  private widgetFont(pointSize?: number, bold = false): FontSpec {
    return pointSize === undefined
      ? { family: this.m_fontFamily, pixelSize: this.m_fontPixelSize, bold }
      : fontWithPointSize(this.m_fontFamily, pointSize, bold);
  }

  // =====================================================================
  // OpenGL
  // =====================================================================

  private initializeGL(): void {
    const gl = this.m_gl;
    if (!gl) return;
    this.releaseGlObjects(false);

    gl.enable(gl.DEPTH_TEST);
    // GL_MULTISAMPLE: WebGL multisampling is requested with the context (antialias: true).
    gl.clearColor(0.075, 0.078, 0.085, 1.0);

    const vertexShader = `#version 300 es
        layout(location = 0) in vec3 aPosition;
        layout(location = 1) in vec3 aColor;
        layout(location = 2) in vec3 aNormal;

        uniform mat4 uMvp;
        uniform mat3 uNormalMatrix;

        out vec3 vColor;
        out vec3 vNormal;

        void main()
        {
            vColor = aColor;
            vNormal = uNormalMatrix * aNormal;
            gl_Position = uMvp * vec4(aPosition, 1.0);
        }
    `;

    const fragmentShader = `#version 300 es
        precision highp float;
        in vec3 vColor;
        in vec3 vNormal;

        uniform bool uUseOverrideColor;
        uniform vec3 uOverrideColor;
        uniform bool uLightingEnabled;

        out vec4 fragColor;

        void main()
        {
            vec3 base = uUseOverrideColor ? uOverrideColor : vColor;
            if (uLightingEnabled && dot(vNormal, vNormal) > 1e-10) {
                // Soft studio lighting follows the camera. Open shells are lit
                // on both sides; ambient light keeps their interiors readable.
                vec3 normal = normalize(vNormal);
                if (!gl_FrontFacing) normal = -normal;
                vec3 keyLight = normalize(vec3(-0.45, 0.75, 1.0));
                vec3 fillLight = normalize(vec3(0.8, -0.25, 0.6));
                float key = max(dot(normal, keyLight), 0.0);
                float fill = max(dot(normal, fillLight), 0.0);
                float brightness = 0.50 + 0.40 * key + 0.10 * fill;
                base *= brightness;
            }
            fragColor = vec4(base, 1.0);
        }
    `;

    const program = createProgram(gl, vertexShader, fragmentShader);
    const lineProgram = createProgram(gl, kWideLineVertexShader, kWideLineFragmentShader);
    if (!program) return;
    this.m_program = {
      program,
      uMvp: gl.getUniformLocation(program, 'uMvp'),
      uNormalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
      uUseOverrideColor: gl.getUniformLocation(program, 'uUseOverrideColor'),
      uOverrideColor: gl.getUniformLocation(program, 'uOverrideColor'),
      uLightingEnabled: gl.getUniformLocation(program, 'uLightingEnabled'),
    };
    if (lineProgram) {
      this.m_lineProgram = {
        program: lineProgram,
        uMvp: gl.getUniformLocation(lineProgram, 'uMvp'),
        uViewport: gl.getUniformLocation(lineProgram, 'uViewport'),
        uLineWidth: gl.getUniformLocation(lineProgram, 'uLineWidth'),
        uUseOverrideColor: gl.getUniformLocation(lineProgram, 'uUseOverrideColor'),
        uOverrideColor: gl.getUniformLocation(lineProgram, 'uOverrideColor'),
      };
    }

    this.m_vao = gl.createVertexArray();
    gl.bindVertexArray(this.m_vao);

    this.m_vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_vertexBuffer);
    if (this.m_gpuVertices.empty()) this.rebuildGpuVertices();

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, kVertexBytes, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, kVertexBytes, 3 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, kVertexBytes, 6 * 4);
    gl.bindVertexArray(null);

    if (this.m_lineProgram) {
      const createQuadStream = (): QuadStream | null => {
        const vao = gl.createVertexArray();
        const buffer = gl.createBuffer();
        if (!vao || !buffer) return null;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        for (let attribute = 0; attribute < 3; ++attribute) {
          gl.enableVertexAttribArray(attribute);
          gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, kLineQuadBytes, attribute * 3 * 4);
        }
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, kLineQuadBytes, 9 * 4);
        gl.bindVertexArray(null);
        return { vao, buffer };
      };
      this.m_wireQuads = createQuadStream();
      this.m_dynamicQuads = createQuadStream();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.m_glReady = true;
    this.uploadVertexData();
    this.m_gpuDirty = false;
    this.updateViewMatrix();
  }

  private resizeGL(_width: number, _height: number): void {
    this.updateProjectionMatrix();
  }

  private setUniformValue(name: BoolUniform, value: boolean): void;
  private setUniformValue(name: 'uOverrideColor', value: QVector3D): void;
  private setUniformValue(name: BoolUniform | 'uOverrideColor', value: boolean | QVector3D): void {
    if (name === 'uOverrideColor') this.m_uniformOverrideColor = value as QVector3D;
    else if (name === 'uUseOverrideColor') this.m_uniformUseOverrideColor = value as boolean;
    else this.m_uniformLightingEnabled = value as boolean;
  }

  private glLineWidth(width: number): void {
    this.m_lineWidth = width;
  }

  /**
   * glDrawArrays with the emulated uniform state. GL_LINES go through the
   * line-quad program (WideLines.ts), which honors glLineWidth and clips
   * against the near plane itself; native gl.LINES remain only a fallback.
   */
  private glDrawArrays(mode: 'GL_LINES' | 'GL_TRIANGLES', first: number, count: number): void {
    const gl = this.m_gl;
    const program = this.m_program;
    if (!gl || !program || count <= 0) return;
    if (mode === 'GL_LINES' && this.drawLineQuads(gl, first, count)) return;
    gl.useProgram(program.program);
    gl.bindVertexArray(this.m_vao);
    gl.uniformMatrix4fv(program.uMvp, false, this.m_mvp.data);
    gl.uniformMatrix3fv(program.uNormalMatrix, false, this.m_normalMatrix);
    gl.uniform1i(program.uUseOverrideColor, this.m_uniformUseOverrideColor ? 1 : 0);
    const c = this.m_uniformOverrideColor;
    gl.uniform3f(program.uOverrideColor, c.x, c.y, c.z);
    gl.uniform1i(program.uLightingEnabled, this.m_uniformLightingEnabled ? 1 : 0);
    gl.drawArrays(mode === 'GL_LINES' ? gl.LINES : gl.TRIANGLES, first, count);
  }

  /** Draws m_gpuVertices[first, first + count) (GL_LINES pairs) from the matching quad stream. */
  private drawLineQuads(gl: WebGL2RenderingContext, first: number, count: number): boolean {
    const program = this.m_lineProgram;
    if (!program) return false;
    let stream: QuadStream | null = null;
    let quadFirst = 0;
    const axes = this.m_dynamicQuadAxesVertices;
    const vectors = this.m_dynamicQuadVectorVertices;
    const wireEnd = this.m_geometryWireVertexStart + this.m_geometryWireVertexCount;
    const connectorLineEnd = this.m_connectorLineStart + this.m_connectorLineCount;
    if (first >= 0 && first + count <= axes) {
      stream = this.m_dynamicQuads;
      quadFirst = first * 3;
    } else if (first >= this.m_geometryWireVertexStart && first + count <= wireEnd) {
      stream = this.m_wireQuads;
      quadFirst = (first - this.m_geometryWireVertexStart) * 3;
    } else if (first >= this.m_vectorVertexStart && first + count <= this.m_vectorVertexStart + vectors) {
      stream = this.m_dynamicQuads;
      quadFirst = (axes + first - this.m_vectorVertexStart) * 3;
    } else if (first >= this.m_connectorLineStart && first + count <= connectorLineEnd) {
      stream = this.m_dynamicQuads;
      quadFirst = (axes + vectors + first - this.m_connectorLineStart) * 3;
    }
    if (!stream) return false;
    gl.useProgram(program.program);
    gl.bindVertexArray(stream.vao);
    gl.uniformMatrix4fv(program.uMvp, false, this.m_mvp.data);
    gl.uniform2f(program.uViewport, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(program.uLineWidth, this.m_lineWidth);
    gl.uniform1i(program.uUseOverrideColor, this.m_uniformUseOverrideColor ? 1 : 0);
    const c = this.m_uniformOverrideColor;
    gl.uniform3f(program.uOverrideColor, c.x, c.y, c.z);
    gl.drawArrays(gl.TRIANGLES, quadFirst, count * 3);
    return true;
  }

  private paintGL(): void {
    const gl = this.m_gl;
    const glActive = gl !== null && this.m_glReady && this.m_program !== null && !gl.isContextLost();
    if (glActive) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      // QPainter draws the debug overlay after the 3D pass and can change GL
      // state. Re-establish opaque depth rendering on every frame, including
      // depth writes before clearing the previous frame's depth buffer.
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    this.updateViewMatrix();
    this.updateProjectionMatrix();

    if (glActive) {
      if (this.m_gpuDirty) this.uploadVertexData();

      const model = new QMatrix4x4();
      model.setToIdentity();
      this.m_mvp = this.m_projection.times(this.m_view).times(model);
      this.m_normalMatrix = this.m_view.normalMatrix();

      this.setUniformValue('uUseOverrideColor', false);
      this.setUniformValue('uLightingEnabled', false);

      this.glLineWidth(1.0);
      if (this.m_axesVertexCount > 0) this.glDrawArrays('GL_LINES', 0, this.m_axesVertexCount);

      if (this.m_showGeometry && this.m_geometryRanges.length > 0) {
        if (this.m_geometryWireframe) {
          // Wireframe intentionally exposes edges behind other geometry.
          gl.disable(gl.DEPTH_TEST);
          gl.depthMask(false);
          this.glLineWidth(1.4);
          for (const range of this.m_geometryWireRanges) {
            if (!this.isGeometryApiVisible(range.apiIndex)) continue;
            this.glDrawArrays('GL_LINES', range.start, range.count);
          }
        } else {
          this.setUniformValue('uLightingEnabled', true);
          for (const range of this.m_geometryRanges) {
            if (!this.isGeometryApiVisible(range.apiIndex)) continue;
            const selected = this.isMeshSelected(range.meshIndex);
            const hovered = this.isMeshInGroup(range.meshIndex, this.m_hoveredMeshIndex);
            this.setUniformValue('uUseOverrideColor', selected || hovered);
            if (selected) this.setUniformValue('uOverrideColor', new QVector3D(0.2, 0.78, 0.95));
            else if (hovered) {
              const color = this.m_geometryScene.meshes[range.meshIndex].color;
              this.setUniformValue(
                'uOverrideColor',
                new QVector3D(color.r, color.g, color.b).mul(0.65).add(new QVector3D(0.35, 0.35, 0.35)),
              );
            }
            this.glDrawArrays('GL_TRIANGLES', range.start, range.count);
          }
          this.setUniformValue('uLightingEnabled', false);
          this.setUniformValue('uUseOverrideColor', false);
        }

        // Highlight selected geometry using the same feature edges as wireframe.
        // This keeps the highlight faithful to the primitive instead of exposing
        // internal triangle diagonals.
        if (this.m_selectedApiIndex >= 0 || this.m_selectedMeshIndex >= 0 || this.m_hoveredMeshIndex >= 0) {
          this.setUniformValue('uUseOverrideColor', true);
          this.glLineWidth(3.0);
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
            this.setUniformValue(
              'uOverrideColor',
              hovered
                ? new QVector3D(0.7, 0.95, 1.0)
                : this.m_selectedMeshIndex >= 0
                  ? new QVector3D(0.82, 1.0, 1.0)
                  : new QVector3D(1.0, 0.92, 0.18),
            );
            this.glDrawArrays('GL_LINES', range.start, range.count);
          }
          this.setUniformValue('uUseOverrideColor', false);
        }

        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
      }

      this.setUniformValue('uUseOverrideColor', false);
      if (this.m_vectorVertexCount > 0) {
        this.glLineWidth(2.0);
        this.glDrawArrays('GL_LINES', this.m_vectorVertexStart, this.m_vectorVertexCount);
      }

      if (this.m_selectedVectorVertexCount > 0) {
        this.glLineWidth(4.0);
        this.glDrawArrays('GL_LINES', this.m_selectedVectorVertexStart, this.m_selectedVectorVertexCount);
      }

      if (!this.m_apiFocusActive && this.m_connectorVertexCount > 0) {
        this.setUniformValue('uUseOverrideColor', false);
        this.setUniformValue('uLightingEnabled', true);
        if (!this.m_geometryWireframe)
          this.glDrawArrays('GL_TRIANGLES', this.m_connectorVertexStart, this.m_connectorVertexCount);
        this.setUniformValue('uLightingEnabled', false);
        this.glLineWidth(2.0);
        // Test outlines and direction arrows stay readable against the source model.
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        this.glDrawArrays('GL_LINES', this.m_connectorLineStart, this.m_connectorLineCount);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
      }
      gl.bindVertexArray(null);
      gl.useProgram(null);
    }

    // Markers and text are screen-space debugging helpers. Their screen anchor is
    // recomputed from the current 3D camera every frame, so labels remain attached
    // while orbiting, panning and zooming.
    const context = this.m_overlayContext;
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.setTransform(this.m_devicePixelRatio, 0, 0, this.m_devicePixelRatio, 0, 0);
    const painter = new OverlayPainter(context, this.m_measurer, this.widgetFont());

    const drawnPointMarkers: QPointF[] = [];
    const drawnLeaders = new Set<string>();

    const pointMarkerAlreadyDrawn = (anchor: QPointF) => {
      for (const used of drawnPointMarkers) {
        const d = anchor.sub(used);
        if (d.x * d.x + d.y * d.y <= 9.0) return true;
      }
      drawnPointMarkers.push(anchor);
      return false;
    };

    for (const item of this.m_debugItems) {
      if (!this.isDebugItemVisible(item)) continue;

      let screen = this.projectToScreen(item.end);
      if (!screen) continue;
      const selected = this.m_selectedVariables.has(item.name);

      // Only points get a circular marker. A vector is already represented by
      // exactly one shaft + one V-shaped arrow head in OpenGL.
      if (item.kind === 'Point' && !pointMarkerAlreadyDrawn(screen)) {
        const fill = selected ? qColor(255, 245, 110) : qColor(255, 174, 52);
        const edge = selected ? qColor(255, 255, 255) : qColor(35, 35, 35);
        const radius = selected ? 7.5 : item.name === kOverviewPointName ? 4.5 : 3.2;
        painter.setPen(qPen(edge, selected ? 2.0 : 1.0));
        painter.setBrush(fill);
        painter.drawEllipse(screen, radius, radius);
      } else if (item.kind === 'Point' && selected) {
        // A selected alias such as points[0] may share the same coordinate as p0.
        // Draw a selection ring without creating a second point marker.
        painter.setPen(qPen(qColor(255, 255, 255), 2.0));
        painter.setBrush(null);
        painter.drawEllipse(screen, 8.5, 8.5);
      }

      // Keep only the selected item's leader. Every label lives in one of
      // the two scrollable side lists, never over the model itself.
      if (this.m_showLabels && selected && !drawnLeaders.has(item.name)) {
        const panel = item.kind === 'Point' ? this.m_pointLabels : this.m_vectorLabels;
        const row = panel.selectedRowRect(item.name);
        if (!row.isEmpty()) {
          if (item.kind === 'Vector')
            screen = this.projectToScreen(item.start.add(item.end.sub(item.start).mul(0.55))) ?? screen;
          const attach = new QPointF(item.kind === 'Point' ? row.right() : row.left(), row.center().y);
          painter.setPen(qPen(qColor(255, 225, 110, 190), 1.2));
          painter.drawLine(screen, attach);
          drawnLeaders.add(item.name);
        }
      }
    }

    // Preselection is drawn last and never changes the real selection or trace.
    for (const item of this.m_debugItems) {
      if (item.name !== this.m_hoveredDebugItem || !this.isDebugItemVisible(item)) continue;
      if (item.kind === 'Point') {
        const screen = this.projectToScreen(item.end);
        if (!screen) continue;
        painter.setPen(qPen(qColor(95, 220, 255), 2.5));
        painter.setBrush(null);
        painter.drawEllipse(screen, 11.0, 11.0);
        painter.setPen(qPen(Qt.white, 1.5));
        painter.setBrush(this.m_selectedVariables.has(item.name) ? qColor(255, 245, 110) : qColor(95, 220, 255));
        painter.drawEllipse(screen, 5.0, 5.0);
      } else {
        const arrow = new VertexArray(8);
        this.appendVectorArrow(arrow, item, false);
        for (let pass = 0; pass < 2; ++pass) {
          painter.setPen(
            qPen(pass === 0 ? qColor(15, 25, 35, 210) : qColor(125, 235, 255), pass === 0 ? 6.0 : 3.0, 'RoundCap'),
          );
          for (let i = 0; i + 1 < arrow.size(); i += 2) {
            const a = this.projectToScreen(arrow.position(i));
            const b = a ? this.projectToScreen(arrow.position(i + 1)) : null;
            if (a && b) painter.drawLine(a, b);
          }
        }
      }
    }
    this.drawConnectorPoints(painter);
    this.drawWorldAxisLabels(painter);
  }

  // =====================================================================
  // Mouse
  // =====================================================================

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
    // Small hand movements while clicking must not move the target first.
    if (this.m_dragDistance < 5) return;

    const creatingPoint = this.m_selectionMode === 'Point' && this.m_pressModifiers.control;
    if (event.buttons & LeftButton && !creatingPoint) {
      // Dragging left should orbit the view to the left (grab-style navigation).
      // The old sign made horizontal orbit feel reversed.
      this.m_yaw -= delta.x * 0.35;
      this.m_pitch += delta.y * 0.35;
      this.m_pitch = clamp(this.m_pitch, -89, 89);
      // The two-line arrow head is camera-facing, so refresh it as the camera orbits.
      this.rebuildGpuVertices();
      this.update();
    }

    if (event.buttons & RightButton) {
      const eye = this.cameraPosition();
      const forward = this.m_target.sub(eye).normalized();
      let right = QVector3D.crossProduct(forward, new QVector3D(0, 0, 1));
      if (right.lengthSquared() < 0.000001) {
        right = new QVector3D(1, 0, 0);
      } else {
        right = right.normalize();
      }
      const up = QVector3D.crossProduct(right, forward).normalized();

      const scale = this.m_distance * 0.0018;
      this.m_target = this.m_target.sub(right.mul(delta.x * scale));
      this.m_target = this.m_target.add(up.mul(delta.y * scale));
      this.buildAxesVertices();
      this.rebuildGpuVertices();
      this.update();
    }
  }

  mouseReleaseEvent(event: MouseEventData): void {
    const position = new QPointF(event.x, event.y);
    if (event.button === LeftButton && this.m_dragDistance < 5) {
      this.updateViewMatrix();
      this.updateProjectionMatrix();
      const connectorId = this.m_selectionMode === 'Point' ? this.pickConnectorPoint(position) : -1;
      if (connectorId >= 0 && !this.m_pressModifiers.control) {
        if (this.m_connectorSelectionCallback) this.m_connectorSelectionCallback(connectorId);
      } else if (this.m_selectionMode === 'Point' && this.m_pressModifiers.control) {
        const point = this.screenToGroundPlane(position);
        if (point && this.m_pointCreationCallback) this.m_pointCreationCallback({ x: point.x, y: point.y, z: point.z });
      } else if (this.m_selectionMode !== 'Mesh') {
        const name = this.pickDebugItem(position, this.m_selectionMode === 'Point' ? 'Point' : 'Vector');
        if (name !== '') {
          const selected = this.m_pressModifiers.shift ? new Set(this.m_selectedVariables) : new Set<string>();
          if (selected.has(name)) selected.delete(name);
          else selected.add(name);
          this.setSelectedVariables(selected);
          if (this.m_selectionChangedCallback) this.m_selectionChangedCallback(new Set(this.m_selectedVariables));
        }
      } else {
        const meshIndex = this.pickMesh(position);
        if (meshIndex >= 0) {
          this.m_selectedMeshIndex = meshIndex;
          this.setSelectedVariables(new Set());
          const mesh = this.m_geometryScene.meshes[meshIndex];
          if (this.m_meshSelectionCallback) this.m_meshSelectionCallback(mesh.apiIndex, mesh.sourceLine);
          this.update();
        }
      }
    }
    if (this.rect().contains(position.toPoint())) this.updateHover(position);
  }

  wheelEvent(event: WheelEventData): void {
    const steps = event.angleDeltaY / 120;
    const zoomFactor = Math.pow(0.86, steps);
    // Keep multiplicative zoom, but remove the old 1000-unit ceiling.
    // 1e8 is a practical guard against floating-point overflow, not a CAD-size limit.
    this.m_distance = clamp(this.m_distance * zoomFactor, 0.01, 1.0e8);
    this.buildAxesVertices();
    this.rebuildGpuVertices();
    this.updateHover(new QPointF(event.x, event.y));
    this.update();
  }

  // =====================================================================
  // Link connector tests
  // =====================================================================

  private appendConnectorVertices(): void {
    const vector = (p: { x: number; y: number; z: number }) => new QVector3D(p.x, p.y, p.z);
    this.m_connectorVertexStart = this.m_gpuVertices.size();
    for (const connector of this.m_connectors) {
      const selected = connector.id === this.m_selectedConnectorId;
      const color = selected ? new QVector3D(0.35, 0.85, 1.0) : new QVector3D(0.18, 0.5, 0.6);
      for (const mesh of connector.meshes) {
        for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
          const a = mesh.vertices[mesh.indices[i]];
          const b = mesh.vertices[mesh.indices[i + 1]];
          const c = mesh.vertices[mesh.indices[i + 2]];
          if (!a || !b || !c) continue;
          const normal = QVector3D.crossProduct(
            new QVector3D(b.x - a.x, b.y - a.y, b.z - a.z),
            new QVector3D(c.x - a.x, c.y - a.y, c.z - a.z),
          ).normalized();
          for (const v of [a, b, c])
            this.m_gpuVertices.push(v.x, v.y, v.z, color.x, color.y, color.z, normal.x, normal.y, normal.z);
        }
      }
    }
    this.m_connectorVertexCount = this.m_gpuVertices.size() - this.m_connectorVertexStart;
    this.m_connectorLineStart = this.m_gpuVertices.size();
    for (const connector of this.m_connectors) {
      const color =
        connector.id === this.m_selectedConnectorId ? new QVector3D(1.0, 0.96, 0.45) : new QVector3D(0.35, 0.7, 0.8);
      const line = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
        this.appendLine(this.m_gpuVertices, vector(a), vector(b), color.x, color.y, color.z);
      };
      for (const [a, b] of connector.outline) line(a, b);
      const tip = connector.point.add(connector.direction.mul(connector.length * 1.65));
      const base = tip.sub(connector.direction.mul(connector.length * 0.22));
      line(connector.point, tip);
      for (const side of [connector.up, connector.direction.crossProduct(connector.up)]) {
        line(tip, base.add(side.mul(connector.length * 0.12)));
        line(tip, base.sub(side.mul(connector.length * 0.12)));
      }
    }
    this.m_connectorLineCount = this.m_gpuVertices.size() - this.m_connectorLineStart;
  }

  private drawConnectorPoints(painter: OverlayPainter): void {
    if (this.m_apiFocusActive) return;
    painter.save();
    for (const connector of this.m_connectors) {
      const screen = this.projectToScreen(new QVector3D(connector.point.x, connector.point.y, connector.point.z));
      if (!screen) continue;
      const selected = connector.id === this.m_selectedConnectorId;
      const hovered = connector.id === this.m_hoveredConnectorId;
      painter.setPen(qPen(hovered ? Qt.white : qColor(18, 30, 35), 2));
      painter.setBrush(selected ? qColor(255, 243, 105) : qColor(70, 205, 230));
      const radius = hovered ? 9 : selected ? 7 : 5;
      painter.drawEllipse(screen, radius, radius);
      if (!selected) continue;
      const label = `${connector.pointName} ${debugValueText(connector.point)}`;
      // painter.fontMetrics().size(Qt::TextSingleLine, label) + QSize(12, 6)
      const font = painter.font();
      const width = horizontalAdvance(this.m_measurer, label, font) + 12;
      const height = fontHeight(this.m_measurer, font) + 6;
      const area = new QRectF(screen.x + 12, screen.y + 8, width, height);
      painter.setPen(null);
      painter.setBrush(qColor(25, 35, 42, 235));
      painter.drawRoundedRect(area, 3, 3);
      painter.setPen(qColor(255, 243, 165));
      painter.drawTextCentered(area, label);
    }
    painter.restore();
  }

  private pickConnectorPoint(screen: QPointF): number {
    if (this.m_apiFocusActive) return -1;
    let best = 18 * 18;
    let result = -1;
    for (const connector of this.m_connectors) {
      const point = this.projectToScreen(new QVector3D(connector.point.x, connector.point.y, connector.point.z));
      if (!point) continue;
      const delta = screen.sub(point);
      const distance = QPointF.dotProduct(delta, delta);
      if (distance < best) {
        best = distance;
        result = connector.id;
      }
    }
    return result;
  }

  // =====================================================================
  // World axes and their labels
  // =====================================================================

  private buildAxesVertices(): void {
    this.m_axesVertices.clear();
    // Labels are projected onto these same axes where they meet the viewport edges.
    const extent = Math.max(10, this.m_sceneScale * 1.45, this.m_target.length() + this.m_distance * 2);
    const colors = [new QVector3D(0.95, 0.2, 0.2), new QVector3D(0.2, 0.9, 0.3), new QVector3D(0.25, 0.45, 1.0)];
    for (let axis = 0; axis < 3; ++axis) {
      const positive = previewOrientationDirection(connectorOrientations[axis * 2]);
      const end = new QVector3D(positive.x * extent, positive.y * extent, positive.z * extent);
      const color = colors[axis];
      // Store the labelled negative end first and positive end second, using
      // precisely the same signed direction as the Link orientation buttons.
      this.appendLine(this.m_axesVertices, end.neg(), end, color.x, color.y, color.z);
    }
  }

  private axisLabelFont(): FontSpec {
    return this.widgetFont(9, true);
  }

  private worldAxisLabels(): AxisLabel[] {
    const labels: AxisLabel[] = [];
    const width = this.width(),
      height = this.height();
    if (width < 80 || height < 80 || this.m_axesVertices.size() !== 6) return labels;
    const transform = this.m_projection.times(this.m_view);
    const screen = new QRectF(0, 0, width, height);
    const inset = screen.adjusted(22, 22, -22, -22);
    const colors = [qColor(242, 70, 70), qColor(65, 230, 90), qColor(95, 145, 255)];
    const labelFont = this.axisLabelFont();
    const occupied: QRectF[] = [];
    if (this.m_pointLabels.isVisible())
      occupied.push(QRectF.fromRect(this.m_pointLabels.geometry()).adjusted(-4, -4, 4, 4));
    if (this.m_vectorLabels.isVisible())
      occupied.push(QRectF.fromRect(this.m_vectorLabels.geometry()).adjusted(-4, -4, 4, 4));
    occupied.push(QRectF.fromRect(this.m_selectionModeButton.geometry).adjusted(-4, -4, 4, 4));
    // Clip a parametric line against a half-space f(t) >= 0. Homogeneous
    // clipping is essential when one end of a world axis is behind the camera.
    const range = { lo: 0, hi: 1 };
    const clip = (start: number, end: number): boolean => {
      if (start < 0 && end < 0) return false;
      if (start < 0) range.lo = Math.max(range.lo, start / (start - end));
      else if (end < 0) range.hi = Math.min(range.hi, start / (start - end));
      return range.lo <= range.hi;
    };
    for (let axis = 0; axis < 3; ++axis) {
      const va = this.m_axesVertices.position(axis * 2);
      const vb = this.m_axesVertices.position(axis * 2 + 1);
      const a = transform.map(QVector4D.fromVector3D(va, 1));
      const b = transform.map(QVector4D.fromVector3D(vb, 1));
      range.lo = 0;
      range.hi = 1;
      let visible = true;
      for (let component = 0; component < 3 && visible; ++component) {
        visible =
          clip(a.w + a.at(component), b.w + b.at(component)) && clip(a.w - a.at(component), b.w - b.at(component));
      }
      if (!visible) continue;
      const ca = a.add(b.sub(a).mul(range.lo));
      const cb = a.add(b.sub(a).mul(range.hi));
      if (ca.w <= 1e-6 || cb.w <= 1e-6) continue;
      const project = (p: QVector4D) => new QPointF((p.x / p.w + 1) * width * 0.5, (1 - p.y / p.w) * height * 0.5);
      const pa = project(ca),
        pb = project(cb);
      range.lo = 0;
      range.hi = 1;
      if (
        !clip(pa.x - inset.left(), pb.x - inset.left()) ||
        !clip(inset.right() - pa.x, inset.right() - pb.x) ||
        !clip(pa.y - inset.top(), pb.y - inset.top()) ||
        !clip(inset.bottom() - pa.y, inset.bottom() - pb.y)
      )
        continue;
      const ends = [pa.add(pb.sub(pa).mul(range.lo)), pa.add(pb.sub(pa).mul(range.hi))];
      const atEdge = (p: QPointF) =>
        Math.min(Math.abs(p.x), Math.abs(p.x - width), Math.abs(p.y), Math.abs(p.y - height)) < 2;
      for (let end = 0; end < 2; ++end) {
        // A foreshortened end can vanish inside the screen. Do not invent
        // a border label if that portion of the axis never reaches it.
        if (!atEdge(end === 0 ? pa : pb)) continue;
        const delta = ends[1 - end].sub(ends[end]);
        const length = Math.hypot(delta.x, delta.y);
        if (length < 25) continue;
        const inward = delta.div(length);
        const text = `${'XYZ'[axis]}${end === 0 ? '-' : '+'}`;
        const sizeWidth = this.m_measurer.horizontalAdvance(text, labelFont) + 8;
        const sizeHeight = fontHeightF(this.m_measurer, labelFont) + 4;
        // Slide along the actual projected axis to avoid lists, controls
        // and coincident axis labels; never detach text into a corner widget.
        for (let offset = 0; offset < length * 0.45; offset += 8) {
          const anchor = ends[end].add(inward.mul(offset));
          const bounds = new QRectF(anchor.x - sizeWidth / 2, anchor.y - sizeHeight / 2, sizeWidth, sizeHeight);
          if (!screen.contains(bounds)) continue;
          if (occupied.some((area) => area.intersects(bounds))) continue;
          labels.push({ text, color: colors[axis], anchor, bounds });
          occupied.push(bounds.adjusted(-3, -3, 3, 3));
          break;
        }
      }
    }
    return labels;
  }

  private drawWorldAxisLabels(painter: OverlayPainter): void {
    painter.save();
    painter.setFont(this.axisLabelFont());
    for (const label of this.worldAxisLabels()) {
      painter.setPen(null);
      painter.setBrush(qColor(18, 19, 20, 220));
      painter.drawRoundedRect(label.bounds, 3, 3);
      painter.setPen(label.color);
      painter.drawTextCentered(label.bounds, label.text);
    }
    painter.restore();
  }

  // =====================================================================
  // Debug items (p0 overview and API-focus parameter snapshots)
  // =====================================================================

  private rebuildDebugItems(result: RuntimeResult): void {
    this.m_debugItems = [];
    let maxPointRadius = 0;
    let maxVectorLength = 0;

    // Overview uses the actual p0 variable, never a synthetic mesh center.
    // If p0 is absent or not a point, do not invent a value for it.
    for (const variable of result.variables) {
      if (variable.name !== kOverviewPointName) continue;
      const point = variable.value;
      if (!isPoint(point)) break;
      const item = new DebugItem();
      item.name = item.label = kOverviewPointName;
      item.valueText = debugValueText(point);
      item.rawValue = new QVector3D(point.x, point.y, point.z);
      item.start = item.end = item.rawValue;
      maxPointRadius = item.rawValue.length();
      this.m_debugItems.push(item);
      break;
    }

    // API-local immutable parameter snapshots. These are hidden during the
    // normal full-scene view and become visible only while API Focus is active.
    // Point/vector inputs use their documented roles and section counts.
    for (let apiIndex = 0; apiIndex < result.apiCalls.length; ++apiIndex) {
      const call = result.apiCalls[apiIndex];
      const metadata = apiParameterMetadataForCall(call);
      const sourceLabel = (formal: string): string => {
        for (let p = 0; p < call.argumentExpressions.length; ++p) {
          const name =
            call.userFunctionCall && p < call.formalParameterNames.length
              ? call.formalParameterNames[p]
              : p < metadata.length
                ? metadata[p].name
                : '';
          if (name !== '' && (formal === name || formal.startsWith(`${name}[`)))
            return call.argumentExpressions[p] + formal.slice(name.length);
        }
        return formal;
      };
      for (const snapshot of resolveDebugPointSnapshots(call)) {
        const item = new DebugItem();
        item.kind = 'Point';
        item.apiIndex = apiIndex;
        item.apiSnapshot = true;
        item.label = sourceLabel(snapshot.name);
        item.name = apiDebugItemId(apiIndex, 'point', snapshot.name);
        item.valueText = debugValueText(snapshot.point);
        item.rawValue = new QVector3D(snapshot.point.x, snapshot.point.y, snapshot.point.z);
        item.start = item.rawValue;
        item.end = item.rawValue;
        maxPointRadius = Math.max(maxPointRadius, item.start.length());
        this.m_debugItems.push(item);
      }

      const placements = resolveDebugVectorAnchors(call);
      for (const placement of placements) {
        const item = new DebugItem();
        item.kind = 'Vector';
        item.apiIndex = apiIndex;
        item.apiSnapshot = true;
        item.label = placement.sourceName;
        item.name = apiDebugItemId(apiIndex, 'vector', placement.parameterName);
        item.valueText = debugValueText(placement.direction);
        item.rawValue = new QVector3D(placement.direction.x, placement.direction.y, placement.direction.z);
        item.start = new QVector3D(placement.anchor.x, placement.anchor.y, placement.anchor.z);
        maxPointRadius = Math.max(maxPointRadius, item.start.length());
        maxVectorLength = Math.max(maxVectorLength, item.rawValue.length());
        this.m_debugItems.push(item);
      }
    }

    this.m_debugSceneScale = Math.max(10, Math.max(maxPointRadius, maxVectorLength));
    this.updateCombinedSceneScale();
    this.m_vectorDisplayScale = 1;

    // Keep one common scale for all vectors, preserving relative vector lengths while
    // making unit directions visible next to models whose coordinates may be hundreds.
    if (maxVectorLength > 1e-6 && maxPointRadius > 8) {
      const desired = Math.max(1.5, maxPointRadius * 0.16);
      if (maxVectorLength < desired) this.m_vectorDisplayScale = Math.min(100, desired / maxVectorLength);
    }

    // Anchors belong to API usages, independently of the current focus filter.
    for (const item of this.m_debugItems) {
      if (item.kind !== 'Vector') continue;
      item.end = item.start.add(item.rawValue.mul(this.m_vectorDisplayScale));
    }
  }

  private updateDebugLabelPanels(): void {
    const points: DebugLabelEntry[] = [];
    const vectors: DebugLabelEntry[] = [];
    const seen = new Set<string>();
    for (const item of this.m_debugItems) {
      // Focus shows immutable API inputs; otherwise show current variables.
      // Repeated placements of one direction share a single name/value row.
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
    const width = this.width(),
      height = this.height();
    const buttonHeight = kSelectionButtonHeight;
    const buttonWidth = Math.max(0, Math.min(width - 2 * kSelectionButtonMargin, kSelectionButtonWidth));
    this.setSelectionModeButton({
      geometry: new QRect(
        kSelectionButtonMargin,
        Math.max(kSelectionButtonMargin, height - kSelectionButtonMargin - buttonHeight),
        buttonWidth,
        buttonHeight,
      ),
    });
    // Each side uses at most 27% of the viewport, with independent scrolling.
    // Reserve the bottom control strip so labels cannot cover the mode button.
    const columnWidth = Math.max(0, Math.min(340, Math.trunc(((width - 24) * 27) / 100)));
    const availableHeight = Math.max(0, height - buttonHeight - 3 * kSelectionButtonMargin);
    this.m_pointLabels.setGeometry(8, 8, columnWidth, Math.min(availableHeight, this.m_pointLabels.contentHeight()));
    const vectorHeight = availableHeight;
    this.m_vectorLabels.setGeometry(
      width - 8 - columnWidth,
      8,
      columnWidth,
      Math.min(vectorHeight, this.m_vectorLabels.contentHeight()),
    );
    const show = this.m_showLabels && availableHeight >= 50 && columnWidth >= 60;
    this.m_pointLabels.setVisible(show && this.m_pointLabels.contentHeight() > 25);
    this.m_vectorLabels.setVisible(
      show && this.m_apiFocusActive && vectorHeight >= 50 && this.m_vectorLabels.contentHeight() > 25,
    );
  }

  private resizeEvent(): void {
    this.clearHover();
    this.layoutDebugLabelPanels();
  }

  private updateSelectionModeButton(): void {
    this.setSelectionModeButton({ text: kSelectionModeNames[this.m_selectionMode] });
  }

  // =====================================================================
  // Hover (preselection)
  // =====================================================================

  private clearHover(): void {
    if (this.m_hoveredDebugItem === '' && this.m_hoveredMeshIndex < 0 && this.m_hoveredConnectorId < 0) return;
    this.m_hoveredDebugItem = '';
    this.m_hoveredMeshIndex = -1;
    this.m_hoveredConnectorId = -1;
    this.unsetCursor();
    this.update();
  }

  private updateHover(screen: QPointF): void {
    if (!this.rect().contains(screen.toPoint()) || this.childAt(screen.toPoint())) {
      this.clearHover();
      return;
    }
    this.updateViewMatrix();
    this.updateProjectionMatrix();
    let debugItem = '';
    let meshIndex = -1;
    const connectorId = this.m_selectionMode === 'Point' ? this.pickConnectorPoint(screen) : -1;
    if (this.m_selectionMode === 'Mesh') meshIndex = this.pickMesh(screen);
    else if (connectorId >= 0) {
      /* Link points have their own selection callback. */
    } else debugItem = this.pickDebugItem(screen, this.m_selectionMode === 'Point' ? 'Point' : 'Vector');
    if (
      debugItem === this.m_hoveredDebugItem &&
      meshIndex === this.m_hoveredMeshIndex &&
      connectorId === this.m_hoveredConnectorId
    )
      return;
    this.m_hoveredDebugItem = debugItem;
    this.m_hoveredMeshIndex = meshIndex;
    this.m_hoveredConnectorId = connectorId;
    if (debugItem !== '' || meshIndex >= 0 || connectorId >= 0) this.setPointingHandCursor();
    else this.unsetCursor();
    this.update();
  }

  leaveEvent(): void {
    this.clearHover();
  }

  /** eventFilter() on the label lists and the Select button: Enter / FocusIn clear the hover. */
  eventFilter(event: 'Enter' | 'FocusIn'): void {
    if (event === 'Enter' || event === 'FocusIn') this.clearHover();
  }

  // =====================================================================
  // GPU vertices
  // =====================================================================

  private rebuildGpuVertices(): void {
    this.clearHover();
    this.m_gpuVertices.assign(this.m_axesVertices);
    this.m_axesVertexCount = this.m_axesVertices.size();

    this.m_geometryRanges = [];
    this.appendGeometryVertices(this.m_gpuVertices);

    // Keep a separate feature-edge representation for wireframe/debug highlighting.
    // Drawing GL_LINE over triangles exposes each triangulation diagonal, which makes
    // a simple rectangular box look like a crossed/twisted polyhedron.  Feature edges
    // preserve actual boundaries/creases and intentionally omit coplanar diagonals.
    this.m_geometryWireRanges = [];
    this.m_geometryWireVertexStart = this.m_gpuVertices.size();
    this.appendGeometryWireVertices(this.m_gpuVertices);
    this.m_geometryWireVertexCount = this.m_gpuVertices.size() - this.m_geometryWireVertexStart;

    this.m_vectorVertexStart = this.m_gpuVertices.size();
    if (this.m_showVectors) {
      for (const item of this.m_debugItems) {
        if (item.kind !== 'Vector' || this.m_selectedVariables.has(item.name) || !this.isDebugItemVisible(item))
          continue;
        this.appendVectorArrow(this.m_gpuVertices, item, false);
      }
    }
    this.m_vectorVertexCount = this.m_gpuVertices.size() - this.m_vectorVertexStart;

    this.m_selectedVectorVertexStart = this.m_gpuVertices.size();
    if (this.m_showVectors) {
      for (const item of this.m_debugItems) {
        if (item.kind !== 'Vector' || !this.m_selectedVariables.has(item.name) || !this.isDebugItemVisible(item))
          continue;
        this.appendVectorArrow(this.m_gpuVertices, item, true);
      }
    }
    this.m_selectedVectorVertexCount = this.m_gpuVertices.size() - this.m_selectedVectorVertexStart;

    this.appendConnectorVertices();

    this.updateDebugLabelPanels();
    this.m_gpuDirty = true;
  }

  private uploadVertexData(): void {
    const gl = this.m_gl;
    if (!this.m_glReady || !gl || !this.m_vertexBuffer) return;

    const data = this.m_gpuVertices.data();
    const size = this.m_gpuVertices.size();
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_vertexBuffer);
    // Web-only optimization: the mesh part between the axes and the debug
    // vectors only changes with the scene, so orbiting re-uploads just the
    // camera-dependent head and tail. The buffer contents equal the C++ upload.
    const staticStart = this.m_axesVertexCount;
    const staticEnd = this.m_vectorVertexStart;
    const uploaded = this.m_uploaded;
    if (
      uploaded.geometryVersion === this.m_geometryVersion &&
      uploaded.staticStart === staticStart &&
      uploaded.staticEnd === staticEnd &&
      size <= uploaded.capacity
    ) {
      if (staticStart > 0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, staticStart * kVertexFloats);
      if (size > staticEnd)
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          staticEnd * kVertexBytes,
          data,
          staticEnd * kVertexFloats,
          (size - staticEnd) * kVertexFloats,
        );
    } else {
      const capacity = size + 4096;
      gl.bufferData(gl.ARRAY_BUFFER, capacity * kVertexBytes, gl.DYNAMIC_DRAW);
      if (size > 0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      this.m_uploaded = { geometryVersion: this.m_geometryVersion, staticStart, staticEnd, capacity };
    }

    // Line quads: feature edges (once per scene), and axes / debug vectors /
    // connector lines (every rebuild, like the C++ upload).
    if (this.m_wireQuads && this.m_wireQuadVersion !== this.m_geometryVersion) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.m_wireQuads.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        expandLineQuads(data, this.m_geometryWireVertexStart, this.m_geometryWireVertexCount),
        gl.STATIC_DRAW,
      );
      this.m_wireQuadVersion = this.m_geometryVersion;
    }
    if (this.m_dynamicQuads) {
      this.m_dynamicQuadAxesVertices = this.m_axesVertexCount;
      this.m_dynamicQuadVectorVertices = this.m_connectorVertexStart - this.m_vectorVertexStart;
      const axes = expandLineQuads(data, 0, this.m_dynamicQuadAxesVertices);
      const vectors = expandLineQuads(data, this.m_vectorVertexStart, this.m_dynamicQuadVectorVertices);
      const connectorLines = expandLineQuads(data, this.m_connectorLineStart, this.m_connectorLineCount);
      const quads = new Float32Array(axes.length + vectors.length + connectorLines.length);
      quads.set(axes);
      quads.set(vectors, axes.length);
      quads.set(connectorLines, axes.length + vectors.length);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.m_dynamicQuads.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, quads, gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.m_gpuDirty = false;
  }

  private appendLine(vertices: VertexArray, a: QVector3D, b: QVector3D, r: number, g: number, bColor: number): void {
    vertices.push(a.x, a.y, a.z, r, g, bColor, 0, 0, 1);
    vertices.push(b.x, b.y, b.z, r, g, bColor, 0, 0, 1);
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

  private appendGeometryVertices(vertices: VertexArray): void {
    const cache = this.geometryVertexCache();
    const base = vertices.size();
    vertices.appendData(cache.triangles);
    for (const range of cache.triangleRanges) this.m_geometryRanges.push({ ...range, start: range.start + base });
  }

  private appendVectorArrow(vertices: VertexArray, item: DebugItem, selected: boolean): void {
    const delta = item.end.sub(item.start);
    const length = delta.length();
    if (length <= 1e-6) return;

    const r = selected ? 1.0 : 0.2;
    const g = selected ? 0.92 : 0.78;
    const b = selected ? 0.2 : 1.0;

    // Exactly one vector: one shaft plus a two-line V arrow head.
    this.appendLine(vertices, item.start, item.end, r, g, b);

    const direction = delta.div(length);
    let toCamera = this.cameraPosition().sub(item.end);
    if (toCamera.lengthSquared() < 1e-8) toCamera = new QVector3D(0, 0, 1);
    else toCamera = toCamera.normalize();

    // Keep the V head roughly camera-facing so it does not turn edge-on.
    let side = QVector3D.crossProduct(direction, toCamera);
    if (side.lengthSquared() < 1e-8) {
      const fallback = Math.abs(direction.z) < 0.9 ? new QVector3D(0, 0, 1) : new QVector3D(0, 1, 0);
      side = QVector3D.crossProduct(direction, fallback);
    }
    side = side.normalize();

    const headLength = clamp(
      length * 0.18,
      Math.max(0.12, this.m_sceneScale * 0.006),
      Math.max(0.5, this.m_sceneScale * 0.035),
    );
    const wing = headLength * 0.52;
    const base = item.end.sub(direction.mul(headLength));

    this.appendLine(vertices, item.end, base.add(side.mul(wing)), r, g, b);
    this.appendLine(vertices, item.end, base.sub(side.mul(wing)), r, g, b);
  }

  private updateCombinedSceneScale(): void {
    this.m_sceneScale = Math.max(10, this.m_debugSceneScale, this.m_geometrySceneScale, this.m_connectorSceneScale);
  }

  private appendGeometryWireVertices(vertices: VertexArray): void {
    const cache = this.geometryVertexCache();
    const base = vertices.size();
    vertices.appendData(cache.wires);
    for (const range of cache.wireRanges) this.m_geometryWireRanges.push({ ...range, start: range.start + base });
  }

  // =====================================================================
  // Camera, projection and picking
  // =====================================================================

  private cameraPosition(): QVector3D {
    const yaw = radians(this.m_yaw);
    const pitch = radians(this.m_pitch);

    const cp = Math.cos(pitch);
    const offset = new QVector3D(
      this.m_distance * cp * Math.cos(yaw),
      this.m_distance * cp * Math.sin(yaw),
      this.m_distance * Math.sin(pitch),
    );

    return this.m_target.add(offset);
  }

  private updateViewMatrix(): void {
    const eye = this.cameraPosition();

    this.m_view.setToIdentity();
    this.m_view.lookAt(eye, this.m_target, new QVector3D(0, 0, 1));
  }

  private updateProjectionMatrix(): void {
    const h = Math.max(1, this.height());
    const aspect = Math.max(1, this.width()) / h;

    // Dynamic clipping planes are essential for CAD-scale scenes. A fixed far
    // plane of 2000 clipped geometry as soon as a primitive grew beyond it.
    // The near plane follows camera distance to retain useful depth precision.
    const nearPlane = Math.max(0.001, Math.min(10000, this.m_distance * 0.001));
    const sceneReach = Math.max(10, this.m_sceneScale * 6);
    const farPlane = Math.max(1000, this.m_distance + sceneReach, nearPlane * 1000);

    this.m_projection.setToIdentity();
    this.m_projection.perspective(45, aspect, nearPlane, farPlane);
  }

  /** bool projectToScreen(world, QPointF &screen): null when not projectable. */
  private projectToScreen(world: QVector3D): QPointF | null {
    const clip = this.m_projection.times(this.m_view).map(QVector4D.fromVector3D(world, 1));
    if (clip.w <= 1e-6) return null;

    const ndc = clip.toVector3DAffine();
    if (ndc.z < -1.05 || ndc.z > 1.05) return null;

    const sx = (ndc.x * 0.5 + 0.5) * this.width();
    const sy = (1.0 - (ndc.y * 0.5 + 0.5)) * this.height();
    if (sx < -100 || sx > this.width() + 100 || sy < -100 || sy > this.height() + 100) return null;

    return new QPointF(sx, sy);
  }

  /** bool screenRay(screen, nearPoint, farPoint) */
  private screenRay(screen: QPointF): { nearPoint: QVector3D; farPoint: QVector3D } | null {
    if (this.width() <= 0 || this.height() <= 0) return null;

    const x = (2.0 * screen.x) / this.width() - 1.0;
    const y = 1.0 - (2.0 * screen.y) / this.height();

    const { matrix: inverse, invertible } = this.m_projection.times(this.m_view).inverted();
    if (!invertible) return null;

    let near4 = inverse.map(new QVector4D(x, y, -1, 1));
    let far4 = inverse.map(new QVector4D(x, y, 1, 1));
    if (Math.abs(near4.w) < 1e-8 || Math.abs(far4.w) < 1e-8) return null;
    near4 = near4.div(near4.w);
    far4 = far4.div(far4.w);

    return { nearPoint: near4.toVector3D(), farPoint: far4.toVector3D() };
  }

  /** bool screenToGroundPlane(screen, QVector3D &world) */
  private screenToGroundPlane(screen: QPointF): QVector3D | null {
    const ray = this.screenRay(screen);
    if (!ray) return null;
    const direction = ray.farPoint.sub(ray.nearPoint);
    if (Math.abs(direction.z) < 1e-7) return null;

    const t = -ray.nearPoint.z / direction.z;
    if (t < 0) return null;
    const world = ray.nearPoint.add(direction.mul(t));
    return new QVector3D(world.x, world.y, 0);
  }

  private isGeometryApiVisible(apiIndex: number): boolean {
    // Mesh selection uses the same geometry filter as explicit API focus.
    // Rendering, picking and Fit Scene all exclude unrelated parts until clear.
    return !this.m_apiFocusActive || this.m_apiFocusIndices.size === 0 || this.m_apiFocusIndices.has(apiIndex);
  }

  private pickMesh(screen: QPointF): number {
    if (!this.m_showGeometry) return -1;
    const ray = this.screenRay(screen);
    if (!ray) return -1;
    const nearPoint = ray.nearPoint;
    const direction = ray.farPoint.sub(nearPoint).normalized();
    let closest = ray.farPoint.sub(nearPoint).length();
    let picked = -1;
    const dx = direction.x,
      dy = direction.y,
      dz = direction.z;
    // Intersect the actual triangles, not their bounding boxes, so holes and
    // occluding faces behave like the opaque preview. Both face sides render.
    // (Scalar Moller-Trumbore, the same arithmetic as the QVector3D version.)
    for (let meshIndex = 0; meshIndex < this.m_geometryScene.meshes.length; ++meshIndex) {
      const mesh = this.m_geometryScene.meshes[meshIndex];
      if (!this.isGeometryApiVisible(mesh.apiIndex)) continue;
      const vertexCount = mesh.vertices.length;
      for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
        const ia = mesh.indices[i],
          ib = mesh.indices[i + 1],
          ic = mesh.indices[i + 2];
        if (!(ia >= 0 && ia < vertexCount && ib >= 0 && ib < vertexCount && ic >= 0 && ic < vertexCount)) continue;
        const a = mesh.vertices[ia],
          b = mesh.vertices[ib],
          c = mesh.vertices[ic];
        const e1x = b.x - a.x,
          e1y = b.y - a.y,
          e1z = b.z - a.z;
        const e2x = c.x - a.x,
          e2y = c.y - a.y,
          e2z = c.z - a.z;
        // cross = direction x edge2
        const cx = dy * e2z - dz * e2y,
          cy = dz * e2x - dx * e2z,
          cz = dx * e2y - dy * e2x;
        const determinant = e1x * cx + e1y * cy + e1z * cz;
        const scale = Math.sqrt((e1x * e1x + e1y * e1y + e1z * e1z) * (e2x * e2x + e2y * e2y + e2z * e2z));
        if (scale === 0 || Math.abs(determinant) <= 1e-8 * scale) continue;
        const tx = nearPoint.x - a.x,
          ty = nearPoint.y - a.y,
          tz = nearPoint.z - a.z;
        const u = (tx * cx + ty * cy + tz * cz) / determinant;
        if (u < -1e-6 || u > 1 + 1e-6) continue;
        // q = delta x edge1
        const qx = ty * e1z - tz * e1y,
          qy = tz * e1x - tx * e1z,
          qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) / determinant;
        if (v < -1e-6 || u + v > 1 + 1e-6) continue;
        const distance = (e2x * qx + e2y * qy + e2z * qz) / determinant;
        if (Number.isFinite(distance) && distance >= 0 && distance < closest) {
          closest = distance;
          picked = meshIndex;
        }
      }
    }
    return picked;
  }

  private pickDebugItem(screen: QPointF, kind: DebugKind): string {
    let bestName = '';
    // Screen-space radii stay usable at every zoom and display scale.
    const radius = kind === 'Point' ? 18 : 12;
    let bestDistance = radius;
    let bestDepth = Number.MAX_VALUE;
    const eye = this.cameraPosition();

    for (const item of this.m_debugItems) {
      if (item.kind !== kind || !this.isDebugItemVisible(item)) continue;
      let distance = radius;

      if (kind === 'Point') {
        const p = this.projectToScreen(item.end);
        if (!p) continue;
        const d = screen.sub(p);
        distance = Math.sqrt(d.x * d.x + d.y * d.y);
      } else {
        // Use the same shaft and arrow head as drawing, including the wings.
        const arrow = new VertexArray(8);
        this.appendVectorArrow(arrow, item, false);
        for (let i = 0; i + 1 < arrow.size(); i += 2) {
          const a = this.projectToScreen(arrow.position(i));
          const b = a ? this.projectToScreen(arrow.position(i + 1)) : null;
          if (a && b) distance = Math.min(distance, distancePointToSegment(screen, a, b));
        }
      }
      if (distance >= radius) continue;
      const depth = item.end.sub(eye).lengthSquared();
      if (
        bestName === '' ||
        distance < bestDistance - 0.01 ||
        (Math.abs(distance - bestDistance) <= 0.01 && depth < bestDepth)
      ) {
        bestDistance = distance;
        bestDepth = depth;
        bestName = item.name;
      }
    }
    return bestName;
  }

  private isDebugItemVisible(item: DebugItem): boolean {
    // API Focus uses immutable per-call snapshots instead of the final Variables
    // state. This is essential for expressions such as fullPoints[i] inside a
    // loop: call #3 and call #4 may reference the same source expression while
    // carrying different evaluated point values.
    if (this.m_apiFocusActive) {
      if (!item.apiSnapshot) return false;
      if (item.apiIndex < 0 || !this.m_apiFocusIndices.has(item.apiIndex)) return false;
    } else {
      // The full scene exposes only p0. Detailed point and vector values
      // are available through the focused API's snapshots.
      if (item.apiSnapshot || item.name !== kOverviewPointName) return false;
    }

    // Individual hide/show applies to p0 and API
    // parameter snapshots. This lets Hide/Show Selected Debug work in API Focus.
    if (this.m_hiddenDebugItems.has(item.name)) return false;

    if (item.kind === 'Point') return this.m_showPoints;
    return this.m_showVectors;
  }
}

// =========================================================================
// Mesh-derived vertices (the bodies of Viewport3D::appendGeometryVertices and
// Viewport3D::appendGeometryWireVertices, computed once per scene).
// =========================================================================

const validIndex = (index: number, count: number) => index >= 0 && index < count;

export function buildGeometryVertices(scene: PreviewGeometryScene): { vertices: VertexArray; ranges: GeometryRange[] } {
  const vertices = new VertexArray(1024);
  const ranges: GeometryRange[] = [];
  let meshIndex = 0;
  for (const mesh of scene.meshes) {
    const range: GeometryRange = { meshIndex: meshIndex++, apiIndex: mesh.apiIndex, start: vertices.size(), count: 0 };

    interface Face {
      indices: [number, number, number];
      areaNormal: QVector3D;
      normal: QVector3D;
    }
    const faces: Face[] = [];
    // std::map<std::array<float,3>, ...>: coincident positions share a key.
    const adjacentFaces = new Map<string, number[]>();
    const position = (index: number): string => {
      const v = mesh.vertices[index];
      return `${v.x},${v.y},${v.z}`;
    };
    // Derive normals from actual faces: some API meshes store section axes
    // as vertex normals, which would give all box walls the same brightness.
    const vertexCount = mesh.vertices.length;
    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const a = mesh.indices[i],
        b = mesh.indices[i + 1],
        c = mesh.indices[i + 2];
      if (!validIndex(a, vertexCount) || !validIndex(b, vertexCount) || !validIndex(c, vertexCount)) continue;
      const va = mesh.vertices[a],
        vb = mesh.vertices[b],
        vc = mesh.vertices[c];
      const areaNormal = QVector3D.crossProduct(
        new QVector3D(vb.x - va.x, vb.y - va.y, vb.z - va.z),
        new QVector3D(vc.x - va.x, vc.y - va.y, vc.z - va.z),
      );
      if (areaNormal.lengthSquared() <= 0) continue;
      const faceIndex = faces.length;
      faces.push({ indices: [a, b, c], areaNormal, normal: areaNormal.normalized() });
      for (const index of [a, b, c]) {
        const key = position(index);
        const adjacent = adjacentFaces.get(key);
        if (adjacent) adjacent.push(faceIndex);
        else adjacentFaces.set(key, [faceIndex]);
      }
    }
    // Blend gently curved surfaces, while preserving sharp box/cap edges
    // and explicitly facetted cylinders. Coincident vertices share shading
    // even when an API splits its surface into separate triangle vertices.
    const creaseCosine = 0.819152; // 35 degrees
    const smooth = mesh.apiName !== 'makeFacettedCylinder';
    for (const face of faces) {
      for (const index of face.indices) {
        let normal = face.normal;
        if (smooth) {
          let sx = 0,
            sy = 0,
            sz = 0;
          for (const neighbor of adjacentFaces.get(position(index)) ?? []) {
            if (QVector3D.dotProduct(face.normal, faces[neighbor].normal) >= creaseCosine) {
              const n = faces[neighbor].areaNormal;
              sx += n.x;
              sy += n.y;
              sz += n.z;
            }
          }
          const sum = new QVector3D(sx, sy, sz);
          if (sum.lengthSquared() > 0) normal = sum.normalized();
        }
        const v = mesh.vertices[index];
        vertices.push(v.x, v.y, v.z, mesh.color.r, mesh.color.g, mesh.color.b, normal.x, normal.y, normal.z);
      }
    }

    range.count = vertices.size() - range.start;
    if (range.count > 0) ranges.push(range);
  }
  return { vertices, ranges };
}

export function buildGeometryWireVertices(scene: PreviewGeometryScene): {
  vertices: VertexArray;
  ranges: GeometryRange[];
} {
  interface EdgeData {
    a: number;
    b: number;
    triangleCount: number;
    firstNormal: QVector3D;
    secondNormal: QVector3D;
  }

  const vertices = new VertexArray(1024);
  const ranges: GeometryRange[] = [];
  let meshIndex = 0;
  for (const mesh of scene.meshes) {
    const range: GeometryRange = { meshIndex: meshIndex++, apiIndex: mesh.apiIndex, start: vertices.size(), count: 0 };

    // std::map<std::pair<uint32, uint32>, EdgeData>, iterated in key order below.
    const edges = new Map<string, EdgeData>();
    const vertexCount = mesh.vertices.length;
    const addEdge = (ia: number, ib: number, normal: QVector3D) => {
      if (!validIndex(ia, vertexCount) || !validIndex(ib, vertexCount) || ia === ib) return;
      const first = Math.min(ia, ib),
        second = Math.max(ia, ib);
      const key = `${first},${second}`;
      let edge = edges.get(key);
      if (!edge) {
        edge = { a: first, b: second, triangleCount: 0, firstNormal: new QVector3D(), secondNormal: new QVector3D() };
        edges.set(key, edge);
      }
      if (edge.triangleCount === 0) edge.firstNormal = normal;
      else if (edge.triangleCount === 1) edge.secondNormal = normal;
      ++edge.triangleCount;
    };

    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const ia = mesh.indices[i];
      const ib = mesh.indices[i + 1];
      const ic = mesh.indices[i + 2];
      if (!validIndex(ia, vertexCount) || !validIndex(ib, vertexCount) || !validIndex(ic, vertexCount)) continue;

      const a = mesh.vertices[ia];
      const b = mesh.vertices[ib];
      const c = mesh.vertices[ic];
      const pa = new QVector3D(a.x, a.y, a.z);
      const pb = new QVector3D(b.x, b.y, b.z);
      const pc = new QVector3D(c.x, c.y, c.z);
      let normal = QVector3D.crossProduct(pb.sub(pa), pc.sub(pa));
      if (normal.lengthSquared() > 1.0e-12) normal = normal.normalize();

      addEdge(ia, ib, normal);
      addEdge(ib, ic, normal);
      addEdge(ic, ia, normal);
    }

    const ordered = [...edges.values()].sort((x, y) => x.a - y.a || x.b - y.b);
    for (const edge of ordered) {
      let feature = edge.triangleCount === 1;
      if (!feature && edge.triangleCount === 2) {
        // The diagonal shared by the two triangles of one planar quad is
        // not a geometry edge. Keep only real creases/boundaries.
        const d = Math.abs(QVector3D.dotProduct(edge.firstNormal, edge.secondNormal));
        feature = d < 0.9995;
      } else if (edge.triangleCount > 2) {
        feature = true;
      }
      if (!feature) continue;

      const a = mesh.vertices[edge.a];
      const b = mesh.vertices[edge.b];
      vertices.push(a.x, a.y, a.z, mesh.color.r, mesh.color.g, mesh.color.b, 0, 0, 1);
      vertices.push(b.x, b.y, b.z, mesh.color.r, mesh.color.g, mesh.color.b, 0, 0, 1);
    }

    range.count = vertices.size() - range.start;
    if (range.count > 0) ranges.push(range);
  }
  return { vertices, ranges };
}

import { LeftButton, MiddleButton, NoButton, NoModifier } from '@/shared/lib/qt';
import type { KeyboardModifiers, MouseEventData, WheelEventData } from '@/shared/lib/qt';
import { kClickDragThreshold } from '@/widgets/viewport/config/viewport';
import type { QRect } from '@/widgets/viewport/lib/math/Rect';
import { QPoint, QPointF, type QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import type { OverlayLayer } from '@/widgets/viewport/lib/render/OverlayLayer';
import type { PickingService } from '@/widgets/viewport/lib/render/PickingService';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';
import type { Vec3 } from '@/widgets/viewport/model/types';

export interface ViewportCallbacks {
  selectionChanged: ((names: Set<string>) => void) | null;
  pointCreation: ((point: Vec3) => void) | null;
  meshSelection: ((apiIndex: number, sourceLine: number) => void) | null;
  connectorSelection: ((id: number) => void) | null;
  selectionCleared?: (() => void) | null;
}

// What input needs from the viewport that owns it.
export interface InputHost {
  readonly callbacks: ViewportCallbacks;
  bounds(): QRect;
  update(): void;
  setCursor(cursor: string): void;
  // The camera moved: rebuild the vertices, and the axes first when `axes`.
  rebuild(axes: boolean): void;
  // Selects debug items and reports the new selection.
  selectDebugItems(names: ReadonlySet<string>): void;
  setSelectedVariables(names: ReadonlySet<string>): void;
  clearSelection(): void;
}

// Mouse input: dragging moves the camera, a click picks or creates, and moving shows what is
// under the cursor.
export class ViewportInput {
  #lastMousePosition = new QPoint();
  #pressPosition = new QPoint();
  #dragDistance = 0;
  #pressModifiers: KeyboardModifiers = NoModifier;
  #orbitStarted = false;
  #orbitPivot: QVector3D | null = null;

  constructor(
    private readonly state: ViewportState,
    private readonly view: CameraController,
    private readonly pickers: PickingService,
    private readonly overlay: OverlayLayer,
    private readonly host: InputHost,
  ) {}

  press(event: MouseEventData): void {
    this.clearHover();
    this.#lastMousePosition = new QPointF(event.x, event.y).toPoint();
    this.#pressPosition = this.#lastMousePosition;
    this.#pressModifiers = event.modifiers;
    this.#dragDistance = 0;
    this.#orbitStarted = false;
    const creatingPoint = this.state.selectionMode === 'Point' && event.modifiers.control;
    this.#orbitPivot = event.buttons & LeftButton && !creatingPoint ? this.view.orbitPivot() : null;
  }

  move(event: MouseEventData): void {
    const position = new QPointF(event.x, event.y);
    const currentPosition = position.toPoint();
    const delta = currentPosition.sub(this.#lastMousePosition);
    this.#lastMousePosition = currentPosition;
    if (event.buttons === NoButton) {
      this.updateHover(position);

      return;
    }
    this.clearHover();
    if (!(event.buttons & (LeftButton | MiddleButton))) return;
    this.#dragDistance += delta.manhattanLength();
    if (this.#dragDistance < kClickDragThreshold) return;
    this.pickers.invalidate();

    const creatingPoint = this.state.selectionMode === 'Point' && this.#pressModifiers.control;
    if (event.buttons & LeftButton && !creatingPoint) {
      let orbitDelta = delta;
      if (!this.#orbitStarted) {
        // Accumulate the startup motion until it is a drag rather than a click.
        orbitDelta = currentPosition.sub(this.#pressPosition);
        if (Math.hypot(orbitDelta.x, orbitDelta.y) < kClickDragThreshold) return;
      }
      // Freeze the mesh-space pivot for this drag, even if preview data changes.
      this.#orbitPivot ??= this.view.orbitPivot();
      this.#orbitStarted = true;
      this.view.camera.orbit(orbitDelta, this.#orbitPivot);
      this.host.rebuild(true);
      this.host.update();
    }
    if (event.buttons & MiddleButton) {
      this.view.camera.pan(delta);
      this.host.rebuild(true);
      this.host.update();
    }
  }

  release(event: MouseEventData): void {
    this.#orbitStarted = false;
    this.#orbitPivot = null;
    const position = new QPointF(event.x, event.y);
    if (event.button === LeftButton && this.#dragDistance < kClickDragThreshold) this.#click(position);
    if (this.host.bounds().contains(position.toPoint())) this.updateHover(position);
  }

  wheel(event: WheelEventData): void {
    this.pickers.invalidate();
    this.view.camera.zoom(event.angleDeltaY);
    this.host.rebuild(true);
    this.updateHover(new QPointF(event.x, event.y));
    this.host.update();
  }

  clearHover(): void {
    const { state } = this;
    if (state.hoveredDebugItem === '' && state.hoveredMeshIndex < 0 && state.hoveredConnectorId < 0) return;
    state.hoveredDebugItem = '';
    state.hoveredMeshIndex = -1;
    state.hoveredConnectorId = -1;
    this.host.setCursor('');
    this.host.update();
  }

  updateHover(screen: QPointF): void {
    const { state, pickers } = this;
    if (!this.host.bounds().contains(screen.toPoint()) || this.overlay.covers(screen.toPoint())) {
      this.clearHover();

      return;
    }
    this.view.updateMatrices();
    const mode = state.selectionMode;
    const mesh = mode === 'Mesh' ? pickers.pickMesh(screen) : undefined;
    const connectorId = mode === 'Mesh' ? (mesh?.connectorId ?? -1) : pickers.pickConnector(screen, mode);
    const meshIndex = mesh?.meshIndex ?? -1;
    const debugItem =
      mode !== 'Mesh' && connectorId < 0 ? pickers.pickDebugItem(screen, mode === 'Point' ? 'Point' : 'Vector') : '';
    if (
      debugItem === state.hoveredDebugItem &&
      meshIndex === state.hoveredMeshIndex &&
      connectorId === state.hoveredConnectorId
    )
      return;
    state.hoveredDebugItem = debugItem;
    state.hoveredMeshIndex = meshIndex;
    state.hoveredConnectorId = connectorId;
    this.host.setCursor(debugItem !== '' || meshIndex >= 0 || connectorId >= 0 ? 'pointer' : '');
    this.host.update();
  }

  #click(position: QPointF): void {
    const { state, pickers, host } = this;
    const { callbacks } = host;
    if (this.overlay.covers(position.toPoint())) return;
    const control = this.#pressModifiers.control;
    this.view.updateMatrices();
    const mode = state.selectionMode;
    const mesh = mode === 'Mesh' ? pickers.pickMesh(position, true) : undefined;
    const connectorId = mode === 'Mesh' ? (mesh?.connectorId ?? -1) : pickers.pickConnector(position, mode, true);
    if (connectorId >= 0 && !(mode === 'Point' && control)) {
      state.selectedMeshIndex = -1;
      host.setSelectedVariables(new Set());
      callbacks.connectorSelection?.(connectorId);
    } else if (state.selectionMode === 'Point' && control) {
      const point = this.view.camera.screenToGroundPlane(position);
      if (point) callbacks.pointCreation?.({ x: point.x, y: point.y, z: point.z });
    } else if (state.selectionMode !== 'Mesh') {
      const name = pickers.pickDebugItem(position, state.selectionMode === 'Point' ? 'Point' : 'Vector', true);
      if (name === '') {
        host.clearSelection();

        return;
      }
      if (state.selectedConnectorId >= 0) callbacks.connectorSelection?.(-1);
      const selected = this.#pressModifiers.shift ? new Set(state.selectedVariables) : new Set<string>();
      if (selected.has(name)) selected.delete(name);
      else selected.add(name);
      host.selectDebugItems(selected);
    } else {
      const meshIndex = mesh?.meshIndex ?? -1;
      if (meshIndex < 0) {
        host.clearSelection();

        return;
      }
      if (state.selectedConnectorId >= 0) callbacks.connectorSelection?.(-1);
      state.selectedMeshIndex = meshIndex;
      host.setSelectedVariables(new Set());
      const pickedMesh = state.geometryScene.meshes[meshIndex];
      callbacks.meshSelection?.(pickedMesh.apiIndex, pickedMesh.sourceLine);
      host.update();
    }
  }
}

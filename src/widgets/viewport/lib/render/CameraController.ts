import type { ConnectorPreview, PreviewGeometryScene } from '@engine/geometry';
import { kMinimumSceneScale } from '@/widgets/viewport/config/viewport';
import { Bounds3D } from '@/widgets/viewport/lib/math/Bounds3D';
import type { QPointF, QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { connectorSceneScale, connectorTip } from '@/widgets/viewport/lib/render/connectorOverlay';
import type { DebugItem } from '@/widgets/viewport/lib/render/DebugItem';
import { appendVectorArrow } from '@/widgets/viewport/lib/render/debugItems';
import { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';
import { axesVertices } from '@/widgets/viewport/lib/render/worldAxes';

// The camera, and what depends on it: the scene scale, the world axes, and fitting the view to
// what is visible.
export class CameraController {
  readonly camera = new ViewportCamera();
  axes = new VertexArray();
  #debugSceneScale = kMinimumSceneScale;
  #geometrySceneScale = kMinimumSceneScale;
  #connectorSceneScale = 0;
  #sceneScale = kMinimumSceneScale;

  constructor(private readonly state: ViewportState) {
    this.rebuildAxes();
  }

  get sceneScale(): number {
    return this.#sceneScale;
  }

  setDebugSceneScale(scale: number): void {
    this.#debugSceneScale = scale;
    this.#updateSceneScale();
  }

  setGeometryScene(scene: PreviewGeometryScene): void {
    this.#geometrySceneScale = kMinimumSceneScale;
    for (const mesh of scene.meshes)
      for (const v of mesh.vertices)
        this.#geometrySceneScale = Math.max(this.#geometrySceneScale, Math.hypot(v.x, v.y, v.z));
    this.#updateSceneScale();
  }

  setConnectors(connectors: readonly ConnectorPreview[]): void {
    this.#connectorSceneScale = connectorSceneScale(connectors);
    this.#updateSceneScale();
  }

  #updateSceneScale(): void {
    this.#sceneScale = Math.max(
      kMinimumSceneScale,
      this.#debugSceneScale,
      this.#geometrySceneScale,
      this.#connectorSceneScale,
    );
  }

  rebuildAxes(): void {
    this.axes = axesVertices(this.#sceneScale, this.camera.target, this.camera.distance);
  }

  updateMatrices(): void {
    this.camera.updateViewMatrix();
    this.camera.updateProjectionMatrix(this.#sceneScale);
  }

  projectToScreen = (world: QVector3D): QPointF | null => this.camera.projectToScreen(world);

  // A vector debug item's arrow as drawn from the current camera.
  vectorArrow(item: DebugItem): VertexArray {
    const arrow = new VertexArray(8);
    appendVectorArrow(arrow, item, false, this.camera.cameraPosition(), this.#sceneScale);

    return arrow;
  }

  // Fits the visible geometry, debug items and connectors; falls back to fitDebugOverlay.
  fitScene(): void {
    const { state } = this;
    const bounds = new Bounds3D();
    if (state.showGeometry) {
      for (const mesh of state.geometryScene.meshes) {
        if (!state.isGeometryApiVisible(mesh.apiIndex)) continue;
        for (const v of mesh.vertices) bounds.addPoint(v);
      }
    }
    this.#addVisibleDebugItems(bounds);
    if (!state.apiFocusActive) {
      for (const connector of state.connectors) {
        for (const mesh of connector.meshes) for (const v of mesh.vertices) bounds.addPoint(v);
        bounds.addPoint(connectorTip(connector));
      }
    }
    if (bounds.isEmpty()) this.fitDebugOverlay();
    else this.camera.fitBounds(bounds.minimum(), bounds.maximum());
  }

  // Fits the visible debug items, or resets the camera when there are none.
  fitDebugOverlay(): void {
    const bounds = new Bounds3D();
    this.#addVisibleDebugItems(bounds);
    if (bounds.isEmpty()) this.camera.reset();
    else this.camera.fitBounds(bounds.minimum(), bounds.maximum());
  }

  #addVisibleDebugItems(bounds: Bounds3D): void {
    for (const item of this.state.debugItems) {
      if (!this.state.isDebugItemVisible(item)) continue;
      if (item.kind === 'Point') {
        bounds.addPoint(item.end);
      } else {
        bounds.addPoint(item.start);
        bounds.addPoint(item.end);
      }
    }
  }
}

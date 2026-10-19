import type { ConnectorPreview, PreviewGeometryScene, PreviewMesh } from '@engine/geometry';
import { kMinimumSceneScale } from '@/widgets/viewport/config/viewport';
import { Bounds3D } from '@/widgets/viewport/lib/math/Bounds3D';
import { QVector3D, type QPointF } from '@/widgets/viewport/lib/math/Vector3D';
import { connectorSceneScale, connectorTip } from '@/widgets/viewport/lib/render/connectorOverlay';
import type { DebugItem } from '@/widgets/viewport/lib/render/DebugItem';
import { appendVectorArrow } from '@/widgets/viewport/lib/render/debugItems';
import { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';
import { ViewportCamera } from '@/widgets/viewport/lib/render/ViewportCamera';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';
import { axesVertices } from '@/widgets/viewport/lib/render/worldAxes';

function meshBounds(meshes: readonly PreviewMesh[]): Bounds3D {
  const bounds = new Bounds3D();
  for (const mesh of meshes)
    for (const index of mesh.indices) {
      const vertex = mesh.vertices[index];
      if (vertex && Number.isFinite(vertex.x) && Number.isFinite(vertex.y) && Number.isFinite(vertex.z))
        bounds.addPoint(vertex);
    }

  return bounds;
}

// The camera, and what depends on it: the scene scale, the world axes, and fitting the view to
// what is visible.
export class CameraController {
  readonly camera = new ViewportCamera();
  axes = new VertexArray();
  #debugSceneScale = kMinimumSceneScale;
  #geometrySceneScale = kMinimumSceneScale;
  #connectorSceneScale = 0;
  #sceneScale = kMinimumSceneScale;
  #geometryOrbitBounds = new Bounds3D();
  #connectorOrbitBounds = new Bounds3D();
  #orbitCenter = new QVector3D();

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
    for (const mesh of scene.meshes) {
      for (const v of mesh.vertices)
        this.#geometrySceneScale = Math.max(this.#geometrySceneScale, Math.hypot(v.x, v.y, v.z));
    }
    this.#geometryOrbitBounds = meshBounds(scene.meshes);
    this.#updateOrbitCenter();
    this.#updateSceneScale();
  }

  setConnectors(connectors: readonly ConnectorPreview[]): void {
    this.#connectorSceneScale = connectorSceneScale(connectors);
    this.#connectorOrbitBounds = meshBounds(connectors.flatMap((connector) => connector.meshes));
    this.#updateOrbitCenter();
    this.#updateSceneScale();
  }

  #updateOrbitCenter(): void {
    const bounds = new Bounds3D();
    for (const source of [this.#geometryOrbitBounds, this.#connectorOrbitBounds]) {
      if (source.isEmpty()) continue;
      bounds.addPoint(source.minimum());
      bounds.addPoint(source.maximum());
    }
    this.#orbitCenter = bounds.isEmpty() ? new QVector3D() : bounds.minimum().add(bounds.maximum()).mul(0.5);
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
    this.axes = axesVertices(
      this.#sceneScale,
      this.camera.target,
      Math.max(this.camera.distance, this.camera.viewHeight()),
    );
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

  // Shared by Fit and ViewCube; hidden/isolate-filtered geometry is excluded.
  sceneBounds(): Bounds3D {
    const { state } = this;
    const bounds = this.#geometryBounds();
    this.#addVisibleDebugItems(bounds);
    for (const connector of state.connectors) {
      if (!state.isConnectorVisible(connector.id)) continue;
      for (const mesh of connector.meshes) for (const v of mesh.vertices) bounds.addPoint(v);
      bounds.addPoint(connectorTip(connector));
    }

    return bounds;
  }

  orbitPivot(): QVector3D {
    // All rendered mesh primitives contribute; debug points and the camera's
    // Pan target do not. Mesh bounds are cached when preview data changes.
    return this.#orbitCenter;
  }

  #geometryBounds(): Bounds3D {
    const bounds = new Bounds3D();
    if (this.state.showGeometry) {
      for (const [index, mesh] of this.state.geometryScene.meshes.entries()) {
        if (!this.state.isMeshVisible(index)) continue;
        for (const v of mesh.vertices) bounds.addPoint(v);
      }
    }

    return bounds;
  }

  fitScene(): void {
    const bounds = this.sceneBounds();
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

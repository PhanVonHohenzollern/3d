import { kRepeatPickDistance } from '@/widgets/viewport/config/viewport';
import type { QPointF } from '@/widgets/viewport/lib/math/Vector3D';
import type { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import { pickConnectorsAt, pickDebugItemsAt, pickMeshesAlongRay } from '@/widgets/viewport/lib/render/picking';
import type { DebugKind } from '@/widgets/viewport/lib/render/types';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';

// What is under the cursor. With context visible, clicking the same spot again picks the next
// thing under it; the service remembers the last pick for that and forgets it (invalidate) when the
// view, the scene or the selection mode changes.
export class PickingService {
  #lastPick: { screen: QPointF; candidates: string; index: number } | null = null;

  constructor(
    private readonly state: ViewportState,
    private readonly view: CameraController,
  ) {}

  invalidate(): void {
    this.#lastPick = null;
  }

  pickMesh(screen: QPointF, advance = false): { meshIndex: number; connectorId: number } | undefined {
    const { state } = this;
    const ray = this.view.camera.screenRay(screen);
    if (!ray) return;
    const targets = state.geometryScene.meshes
      .map((mesh, meshIndex) => ({ mesh, meshIndex, connectorId: -1 }))
      .filter(({ meshIndex }) => state.showGeometry && state.isMeshVisible(meshIndex));
    for (const connector of state.connectors.filter((item) => state.isConnectorVisible(item.id)))
      for (const mesh of connector.meshes) targets.push({ mesh, meshIndex: -1, connectorId: connector.id });
    const hits = pickMeshesAlongRay(
      targets.map((target) => target.mesh),
      ray,
      () => true,
      { screen, project: this.view.projectToScreen },
    );
    const seen = new Set<number>();
    const candidates = hits.filter((index) => {
      const { connectorId } = targets[index];
      if (connectorId < 0) return true;
      if (seen.has(connectorId)) return false;
      seen.add(connectorId);

      return true;
    });
    const index = this.#cycle(candidates, screen, advance);

    return index === undefined ? undefined : targets[index];
  }

  pickDebugItem(screen: QPointF, kind: DebugKind, advance = false): string {
    const { state, view } = this;

    return (
      this.#cycle(
        pickDebugItemsAt(
          state.debugItems,
          kind,
          screen,
          view.camera.cameraPosition(),
          (item) => state.isDebugItemPickable(item),
          view.projectToScreen,
          (item) => view.vectorArrow(item),
        ),
        screen,
        advance,
      ) ?? ''
    );
  }

  pickConnector(screen: QPointF, kind: DebugKind, advance = false): number {
    return (
      this.#cycle(
        pickConnectorsAt(
          this.state.connectors.filter((item) => this.state.isConnectorVisible(item.id)),
          kind,
          screen,
          this.view.projectToScreen,
        ),
        screen,
        advance,
      ) ?? -1
    );
  }

  #cycle<T extends string | number>(candidates: T[], screen: QPointF, advance: boolean): T | undefined {
    if (this.state.isolateSelection) return candidates[0];
    const signature = `${this.state.selectionMode}:${candidates.join(',')}`;
    const previous = this.#lastPick;
    const same =
      previous &&
      previous.candidates === signature &&
      screen.sub(previous.screen).toPoint().manhattanLength() < kRepeatPickDistance;
    const index = same ? (previous.index + (advance ? 1 : 0)) % candidates.length : 0;
    if (advance && candidates.length) this.#lastPick = { screen, candidates: signature, index };

    return candidates[index];
  }
}

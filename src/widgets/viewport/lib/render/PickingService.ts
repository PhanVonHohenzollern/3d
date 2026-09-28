import { kRepeatPickDistance } from '@/widgets/viewport/config/viewport';
import type { QPointF } from '@/widgets/viewport/lib/math/Vector3D';
import type { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import { pickConnectorAt, pickDebugItemsAt, pickMeshesAlongRay } from '@/widgets/viewport/lib/render/picking';
import type { DebugKind } from '@/widgets/viewport/lib/render/types';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';

// What is under the cursor. In the Unite presentation, clicking the same spot again picks the next
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

  pickMesh(screen: QPointF, advance = false): number {
    const { state } = this;
    if (!state.showGeometry) return -1;
    const ray = this.view.camera.screenRay(screen);
    if (!ray) return -1;

    return (
      this.#cycle(
        pickMeshesAlongRay(state.geometryScene.meshes, ray, (apiIndex) => state.isGeometryApiVisible(apiIndex)),
        screen,
        advance,
      ) ?? -1
    );
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

  pickConnectorPoint(screen: QPointF): number {
    if (this.state.apiFocusActive) return -1;

    return pickConnectorAt(this.state.connectors, screen, this.view.projectToScreen);
  }

  #cycle<T extends string | number>(candidates: T[], screen: QPointF, advance: boolean): T | undefined {
    if (this.state.selectionPresentation !== 'Unite') return candidates[0];
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

import type { ConnectorPreview, PreviewGeometryScene } from '@engine/geometry';
import type { DebugItem } from '@/widgets/viewport/lib/render/DebugItem';
import { kOverviewPointName } from '@/widgets/viewport/lib/render/debugItems';
import type { SelectionMode } from '@/widgets/viewport/lib/render/types';

// What the viewport shows and what is selected in it, and the rules for what is visible and
// pickable. The camera, picking, overlay and renderer read this; the engine changes it.
export class ViewportState {
  geometryScene: PreviewGeometryScene = { meshes: [], warnings: [] };
  debugItems: DebugItem[] = [];
  connectors: ConnectorPreview[] = [];
  selectedConnectorId = -1;

  showPoints = true;
  showVectors = true;
  showLabels = true;
  showGeometry = true;
  geometryWireframe = false;

  selectionMode: SelectionMode = 'Point';
  selectionPresentation: 'Separate' | 'Unite' = 'Separate';
  selectedVariables = new Set<string>();
  selectedApiIndex = -1;
  selectedMeshIndex = -1;
  meshFocusActive = false;
  apiFocusActive = false;
  apiFocusIndices = new Set<number>();
  debugFocusIndices = new Set<number>();
  hiddenDebugItems = new Set<string>();

  hoveredDebugItem = '';
  hoveredMeshIndex = -1;
  hoveredConnectorId = -1;

  // Meshes of one API call select and hover together.
  isMeshInGroup(meshIndex: number, pickedIndex: number): boolean {
    const count = this.geometryScene.meshes.length;
    if (pickedIndex < 0 || pickedIndex >= count || meshIndex < 0 || meshIndex >= count) return false;
    const apiIndex = this.geometryScene.meshes[pickedIndex].apiIndex;

    return apiIndex >= 0 ? this.geometryScene.meshes[meshIndex].apiIndex === apiIndex : meshIndex === pickedIndex;
  }

  isMeshSelected(meshIndex: number): boolean {
    return this.isMeshInGroup(meshIndex, this.selectedMeshIndex);
  }

  isGeometryApiVisible(apiIndex: number): boolean {
    return (
      this.selectionPresentation === 'Unite' ||
      !this.apiFocusActive ||
      this.apiFocusIndices.size === 0 ||
      this.apiFocusIndices.has(apiIndex)
    );
  }

  isDebugItemVisible(item: DebugItem): boolean {
    if (this.apiFocusActive) {
      if (!item.apiSnapshot) return false;
      if (item.apiIndex < 0 || !this.debugFocusIndices.has(item.apiIndex)) return false;
    } else {
      if (item.apiSnapshot || item.name !== kOverviewPointName) return false;
    }

    if (this.hiddenDebugItems.has(item.name)) return false;

    if (item.kind === 'Point') return this.showPoints;

    return this.showVectors;
  }

  isDebugItemPickable(item: DebugItem): boolean {
    if (this.selectionPresentation !== 'Unite') return this.isDebugItemVisible(item);

    // Unite can pick other API calls without displaying all their points and vectors.
    if (!item.apiSnapshot && item.name !== kOverviewPointName) return false;
    if (this.hiddenDebugItems.has(item.name)) return false;

    return item.kind === 'Point' ? this.showPoints : this.showVectors;
  }
}

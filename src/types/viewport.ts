import type { ConnectorPreview } from '../core/geometry/ConnectorPreview';
import type { PreviewGeometryScene } from '../core/geometry/PreviewGeometryEngine';
import type { RuntimeResult } from '../core/runtime/RuntimeTypes';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Viewport3DHandle {
  setRuntimeResult(result: RuntimeResult): void;
  setShowPoints(visible: boolean): void;
  setShowVectors(visible: boolean): void;
  setShowLabels(visible: boolean): void;
  setDebugItemVisible(name: string, visible: boolean): void;
  hideAllDebugItems(): void;
  showAllDebugItems(): void;
  setSelectedVariable(name: string): void;
  setSelectedVariables(names: ReadonlySet<string>): void;
  selectedDebugItems(): Set<string>;
  fitDebugOverlay(): void;

  setGeometryScene(scene: PreviewGeometryScene): void;
  setShowGeometry(visible: boolean): void;
  setGeometryWireframe(wireframe: boolean): void;
  setSelectedApiCall(apiIndex: number, keepMeshSelection?: boolean): void;
  selectedMeshIndex(): number;
  isMeshSelected(meshIndex: number): boolean;
  hasApiFocus(): boolean;
  hasMeshFocus(): boolean;
  setApiFocusIndices(indices: ReadonlySet<number>): void;
  clearApiFocus(): void;
  fitScene(): void;
  setConnectorPreviews(connectors: readonly ConnectorPreview[], selectedId: number): void;
}

export interface Viewport3DProps {
  onSelectionChanged?: (names: Set<string>) => void;
  onPointCreation?: (point: Vec3) => void;
  onMeshSelection?: (apiIndex: number, sourceLine: number) => void;
  onConnectorSelection?: (id: number) => void;
}

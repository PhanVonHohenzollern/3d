// Contract between the App (port of MainWindow) and the Viewport3D component
// (port of renderer/Viewport3D). Method-for-method equivalent of the public
// Viewport3D C++ API; App drives it imperatively through a React ref, exactly
// as MainWindow drives the Qt widget.

import type { ConnectorPreview } from '../geometry/ConnectorPreview';
import type { PreviewGeometryScene } from '../geometry/PreviewGeometryEngine';
import type { RuntimeResult } from '../runtime/RuntimeTypes';

/** QVector3D */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Debug-item ID of one API point/vector parameter snapshot. Shared by
 * Viewport3D (markers) and ApiTracePanel (parameter rows), so selections can
 * be exchanged as ID sets. Other debug items use the runtime variable name.
 */
export function apiDebugItemId(apiIndex: number, kind: 'point' | 'vector', parameterName: string): string {
  return `@api${apiIndex}:${kind}:${parameterName}`;
}
export const isApiDebugItemId = (id: string) => id.startsWith('@api');

export interface Viewport3DHandle {
  // Debug geometry overlay generated from the runtime state.
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

  // Generated preview geometry.
  setGeometryScene(scene: PreviewGeometryScene): void;
  setShowGeometry(visible: boolean): void;
  setGeometryWireframe(wireframe: boolean): void;
  setSelectedApiCall(apiIndex: number, keepMeshSelection?: boolean): void;
  /** The hit identifies one part; selection includes every part of that API call. */
  selectedMeshIndex(): number;
  isMeshSelected(meshIndex: number): boolean;
  hasApiFocus(): boolean;
  hasMeshFocus(): boolean;
  /** API Focus hides geometry/debug state unrelated to the selected call. */
  setApiFocusIndices(indices: ReadonlySet<number>): void;
  clearApiFocus(): void;
  fitScene(): void;
  setConnectorPreviews(connectors: readonly ConnectorPreview[], selectedId: number): void;
}

/** The C++ set...Callback() setters become props. */
export interface Viewport3DProps {
  onSelectionChanged?: (names: Set<string>) => void;
  onPointCreation?: (point: Vec3) => void;
  onMeshSelection?: (apiIndex: number, sourceLine: number) => void;
  onConnectorSelection?: (id: number) => void;
}

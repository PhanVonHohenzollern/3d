import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import type { Viewport3DHandle } from '../types/viewport';

export function createViewport3DHandle(engine: ViewportEngine): Viewport3DHandle {
  return {
    setRuntimeResult: (result) => engine.setRuntimeResult(result),
    setShowPoints: (visible) => engine.setShowPoints(visible),
    setShowVectors: (visible) => engine.setShowVectors(visible),
    setShowLabels: (visible) => engine.setShowLabels(visible),
    setDebugItemVisible: (name, visible) => engine.setDebugItemVisible(name, visible),
    hideAllDebugItems: () => engine.hideAllDebugItems(),
    showAllDebugItems: () => engine.showAllDebugItems(),
    setSelectedVariable: (name) => engine.setSelectedVariable(name),
    setSelectedVariables: (names) => engine.setSelectedVariables(names),
    selectedDebugItems: () => engine.selectedDebugItems(),
    fitDebugOverlay: () => engine.fitDebugOverlay(),
    setGeometryScene: (scene) => engine.setGeometryScene(scene),
    setShowGeometry: (visible) => engine.setShowGeometry(visible),
    setGeometryWireframe: (wireframe) => engine.setGeometryWireframe(wireframe),
    setSelectedApiCall: (apiIndex, keepMeshSelection = false) => engine.setSelectedApiCall(apiIndex, keepMeshSelection),
    selectedMeshIndex: () => engine.selectedMeshIndex(),
    isMeshSelected: (meshIndex) => engine.isMeshSelected(meshIndex),
    hasApiFocus: () => engine.hasApiFocus(),
    hasMeshFocus: () => engine.hasMeshFocus(),
    setApiFocusIndices: (indices) => engine.setApiFocusIndices(indices),
    clearApiFocus: () => engine.clearApiFocus(),
    fitScene: () => engine.fitScene(),
    setConnectorPreviews: (connectors, selectedId) => engine.setConnectorPreviews(connectors, selectedId),
  };
}

import { identityMatrix, multiply, type DMat4 } from '../../utils/dmat4';
import { apiSignatureMetadataForCall } from '../runtime/ApiMetadata';
import type { RuntimeApiCall, RuntimeResult } from '../runtime/RuntimeTypes';
import { appendCompositeApiMeshes, appendPrimitiveApiMeshes } from './adapters/apiAdapters';
import { effectiveArguments, isGeometryCallName, warningFor } from './helpers/apiCall';
import { meshColorUpdate } from './helpers/colors';
import { applyTransform, meshTransformDelta } from './helpers/meshTransform';
import { MeshBuildContext } from './MeshBuildContext';
import { defaultPreviewColor, type PreviewColor, type PreviewGeometryScene } from './previewScene';

export {
  defaultPreviewColor,
  type PreviewColor,
  type PreviewGeometryScene,
  type PreviewMesh,
  type PreviewMeshVertex,
} from './previewScene';

const adapterWarningHeaders = new Set([
  'PnGeometry3d.h',
  'GeoCache3dInt.h',
  'SymbolsInt.h',
  'GrillsInt.h',
  'TubularPrimitivesInt.h',
  'RectangularPrimitivesInt.h',
  'VascoPrimitivesInt.h',
  'BowlPrimitivesInt.h',
]);

function missingAdapterWarning(call: RuntimeApiCall): string | null {
  if (call.userFunctionCall) return null;
  const sig = apiSignatureMetadataForCall(call);
  if (!sig || !adapterWarningHeaders.has(sig.sourceHeader) || !isGeometryCallName(call.name)) return null;

  return warningFor(call, 'preview adapter not implemented; no substitute mesh was generated');
}

export class PreviewGeometryEngine {
  build(result: RuntimeResult): PreviewGeometryScene {
    const scene: PreviewGeometryScene = { meshes: [], warnings: [] };
    let currentColor: PreviewColor = defaultPreviewColor();
    let currentTransform = identityMatrix();
    const transformByApi = new Map<number, DMat4>();

    for (let apiIndex = 0; apiIndex < result.apiCalls.length; ++apiIndex) {
      const call = result.apiCalls[apiIndex];
      const args = effectiveArguments(call);

      if (call.name === 'preTransformMesh' || call.name === 'postTransformMesh') {
        const delta = meshTransformDelta(args);
        if (!delta) scene.warnings.push(warningFor(call, 'invalid mesh transform arguments'));
        else if (call.name === 'preTransformMesh') currentTransform = multiply(delta, currentTransform);
        else currentTransform = multiply(currentTransform, delta);
        continue;
      }

      if (call.name === 'setPrimitiveMode') continue;
      transformByApi.set(apiIndex, currentTransform);

      if (call.name === 'setMeshColor') {
        const update = meshColorUpdate(args);
        if ('warning' in update) scene.warnings.push(warningFor(call, update.warning));
        else currentColor = update.color;
        continue;
      }

      const context = new MeshBuildContext(call, apiIndex, currentColor);
      if (appendPrimitiveApiMeshes(scene, context, args) || appendCompositeApiMeshes(scene, context, args)) continue;

      const warning = missingAdapterWarning(call);
      if (warning) scene.warnings.push(warning);
    }

    for (const mesh of scene.meshes) {
      const transform = transformByApi.get(mesh.apiIndex);
      if (transform !== undefined) applyTransform(mesh, transform);
    }

    return scene;
  }
}

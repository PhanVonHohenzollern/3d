import { identityMatrix, multiply, type DMat4 } from '@engine/math';
import { effectiveApiArguments, type RuntimeApiCall, type RuntimeResult } from '@engine/runtime';
import {
  appendCompositeApiMeshes,
  appendPrimitiveApiMeshes,
  kCompositeGeometryHeaders,
  supportedPreviewApiNames,
} from '@engine/geometry/adapters/apiAdapters';
import { isGeometryCallName, warningFor } from '@engine/geometry/helpers/apiCall';
import { meshColorUpdate } from '@engine/geometry/helpers/colors';
import { applyTransform, meshTransformDelta } from '@engine/geometry/helpers/meshTransform';
import { asNumber, ref } from '@engine/geometry/helpers/valueDecoding';
import { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import { defaultPreviewColor, type PreviewColor, type PreviewGeometryScene } from '@engine/geometry/previewScene';

export {
  defaultPreviewColor,
  type PreviewColor,
  type PreviewGeometryScene,
  type PreviewMesh,
  type PreviewMeshVertex,
} from '@engine/geometry/previewScene';

// Calls from these headers get a warning when no adapter draws them.
const adapterWarningHeaders = new Set([...kCompositeGeometryHeaders, 'PnGeometry3d.h']);

function missingAdapterWarning(call: RuntimeApiCall): string | null {
  if (call.userFunctionCall) return null;
  if (supportedPreviewApiNames().includes(call.name))
    return warningFor(call, 'invalid arguments or unsupported overload for this preview adapter');
  const sig = call.signature;
  if (!sig || !adapterWarningHeaders.has(sig.sourceHeader) || !isGeometryCallName(call.name)) return null;

  return warningFor(call, 'preview adapter not implemented; no substitute mesh was generated');
}

export class PreviewGeometryEngine {
  build(result: RuntimeResult): PreviewGeometryScene {
    const scene: PreviewGeometryScene = { meshes: [], warnings: [] };
    let currentColor: PreviewColor = defaultPreviewColor();
    let externalInsulation = false;
    const insulationColor: PreviewColor = { r: Math.fround(139 / 255), g: 0, b: 0 };
    let currentTransform = identityMatrix();
    const transformByApi = new Map<number, DMat4>();

    for (let apiIndex = 0; apiIndex < result.apiCalls.length; ++apiIndex) {
      const call = result.apiCalls[apiIndex];
      if (call.userFunctionCall) continue;
      const args = effectiveApiArguments(call);

      if (call.name === 'preTransformMesh' || call.name === 'postTransformMesh') {
        const delta = meshTransformDelta(args);
        if (!delta) scene.warnings.push(warningFor(call, 'invalid mesh transform arguments'));
        else if (call.name === 'preTransformMesh') currentTransform = multiply(delta, currentTransform);
        else currentTransform = multiply(currentTransform, delta);
        continue;
      }

      if (call.name === 'setPrimitiveMode') {
        const mode = ref(0);
        if (args.length === 1 && asNumber(args[0], mode)) externalInsulation = Math.trunc(mode.v) === 2; // FLM3Geo::pmExtInsulation
        continue;
      }
      transformByApi.set(apiIndex, currentTransform);

      if (call.name === 'setMeshColor') {
        const update = meshColorUpdate(args);
        if ('warning' in update) scene.warnings.push(warningFor(call, update.warning));
        else currentColor = update.color;
        continue;
      }

      const context = new MeshBuildContext(call, apiIndex, externalInsulation ? insulationColor : currentColor);
      const firstMesh = scene.meshes.length;
      if (appendPrimitiveApiMeshes(scene, context, args) || appendCompositeApiMeshes(scene, context, args)) {
        // Repeated grille blades and symbol strokes share one draw call. Keep
        // named subparts (e.g. intersection.main/branch) separately selectable.
        if (scene.meshes.length - firstMesh > 8) {
          const grouped = new Map<string, PreviewGeometryScene['meshes'][number]>();
          for (const mesh of scene.meshes.splice(firstMesh)) {
            const key = mesh.apiName + ':' + String(mesh.preserveNormals);
            const existing = grouped.get(key);
            if (!existing) {
              grouped.set(key, mesh);
              continue;
            }
            const offset = existing.vertices.length;
            for (const v of mesh.vertices) existing.vertices.push(v);
            for (const i of mesh.indices) existing.indices.push(i + offset);
          }
          scene.meshes.push(...grouped.values());
        }
        continue;
      }

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

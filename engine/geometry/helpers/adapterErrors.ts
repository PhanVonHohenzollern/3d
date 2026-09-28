import type { RuntimeValue } from '@engine/runtime/RuntimeValue';
import type { ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { warningFor } from '@engine/geometry/helpers/apiCall';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// An adapter whose errors become a warning on the call instead of stopping the preview. The call
// still counts as handled, so no "unsupported" warning is added on top.
export function withAdapterErrors(
  fallbackMessage: string,
  build: (scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]) => void,
): ApiMeshAdapter {
  return (scene, context, args) => {
    try {
      build(scene, context, args);
    } catch (error) {
      scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : fallbackMessage));
    }

    return true;
  };
}

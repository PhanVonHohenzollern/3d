import type { RuntimeValue } from '@engine/runtime';
import type { ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { warningFor } from '@engine/geometry/helpers/apiCall';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// How every adapter reports bad input:
// - a call without a matching SDK overload is not handled (false), and the engine warns that the
//   arguments or overload are unsupported;
// - otherwise the build reads its arguments through NamedArguments, and an error there (or in the
//   geometry) becomes a warning naming the problem; the call still counts as handled.
// A build that returns false did not recognise its arguments and is reported as unsupported too.
export function withAdapterErrors(
  fallbackMessage: string,
  build: (scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]) => boolean | void,
): ApiMeshAdapter {
  return (scene, context, args) => {
    if (!context.call.signature) return false;
    try {
      if (build(scene, context, args) === false) return false;
    } catch (error) {
      scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : fallbackMessage));
    }

    return true;
  };
}

// withAdapterErrors for a build that reads its arguments by name.
export function namedAdapter(
  fallbackMessage: string,
  build: (scene: PreviewGeometryScene, context: MeshBuildContext, a: NamedArguments) => boolean | void,
): ApiMeshAdapter {
  return withAdapterErrors(fallbackMessage, (scene, context, args) =>
    build(scene, context, new NamedArguments(context, args)),
  );
}

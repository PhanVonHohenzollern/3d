import type { RuntimeValue } from '@engine/runtime/RuntimeValue';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';

// Builds the preview meshes for one API call. Returns false when it cannot handle the arguments,
// so the engine reports the call as unsupported.
export type ApiMeshAdapter = (scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]) => boolean;

// One entry per API name. Each adapter module exports its tables and the registry merges them.
export type AdapterTable = Readonly<Record<string, ApiMeshAdapter>>;

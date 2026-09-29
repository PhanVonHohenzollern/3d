import type { RuntimeApiCall } from '@engine/runtime';
import type { PreviewColor, PreviewMesh } from '@engine/geometry/previewScene';

export class MeshBuildContext {
  constructor(
    readonly call: RuntimeApiCall,
    readonly apiIndex: number,
    readonly color: PreviewColor,
  ) {}

  createMesh(part = ''): PreviewMesh {
    return {
      apiIndex: this.apiIndex,
      sourceLine: this.call.line,
      apiName: this.call.name + part,
      color: { r: this.color.r, g: this.color.g, b: this.color.b },
      vertices: [],
      indices: [],
    };
  }
}

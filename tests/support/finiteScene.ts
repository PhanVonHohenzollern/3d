import { expect } from 'vitest';
import type { PreviewGeometryScene } from '@/core/geometry/previewScene';

// A NaN or infinite vertex never renders, so an adapter that produces one fails silently in the app.
export function expectFiniteScene(scene: PreviewGeometryScene): void {
  const broken = scene.meshes.flatMap((mesh) =>
    mesh.vertices
      .map((vertex, index) => ({ mesh: mesh.apiName, index, vertex }))
      .filter(({ vertex }) => ![vertex.x, vertex.y, vertex.z, vertex.nx, vertex.ny, vertex.nz].every(Number.isFinite)),
  );
  expect(broken.slice(0, 3), `${broken.length} non-finite vertices`).toEqual([]);
}

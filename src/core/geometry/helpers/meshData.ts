import type { DVec3 } from '../../../utils/DVec3';
import type { PreviewGeometryScene, PreviewMesh, PreviewMeshVertex } from '../previewScene';

export const f32 = Math.fround;

export function vertex(p: DVec3, n: DVec3): PreviewMeshVertex {
  return {
    x: f32(p.x),
    y: f32(p.y),
    z: f32(p.z),
    nx: f32(n.x),
    ny: f32(n.y),
    nz: f32(n.z),
  };
}

export function addTriangle(mesh: PreviewMesh, a: number, b: number, c: number): void {
  mesh.indices.push(a >>> 0);
  mesh.indices.push(b >>> 0);
  mesh.indices.push(c >>> 0);
}

export function pushNonEmptyMesh(scene: PreviewGeometryScene, mesh: PreviewMesh): void {
  if (mesh.vertices.length === 0 || mesh.indices.length === 0) return;
  scene.meshes.push(mesh);
}

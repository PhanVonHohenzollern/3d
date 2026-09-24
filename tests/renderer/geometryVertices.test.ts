// Mesh-derived GPU vertices: face-derived normals with crease-limited
// smoothing (appendGeometryVertices) and feature edges (appendGeometryWireVertices).
import { describe, expect, it } from 'vitest';
import type { PreviewMesh } from '../../src/geometry/PreviewGeometryEngine';
import { QVector3D } from '../../src/renderer/Vector3D';
import { kVertexFloats } from '../../src/renderer/VertexArray';
import { expandLineQuads, kLineQuadFloats } from '../../src/renderer/WideLines';
import { buildGeometryVertices, buildGeometryWireVertices } from '../../src/renderer/ViewportEngine';
import { boxMesh, scene } from './helpers';

function normalAt(data: Float32Array, vertex: number): QVector3D {
  const o = vertex * kVertexFloats;
  return new QVector3D(data[o + 6], data[o + 7], data[o + 8]);
}

/** Two triangles sharing edge (1,2); their face normals differ by `degrees` (0 = flat). */
function foldedPair(degrees: number, apiName = 'makeTube'): PreviewMesh {
  const t = (degrees * Math.PI) / 180;
  const vertices = [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: Math.cos(t), z: Math.sin(t) },
  ].map((v) => ({ ...v, nx: 0, ny: 0, nz: 0 }));
  return { apiIndex: 0, sourceLine: 1, apiName, color: { r: 1, g: 0, b: 0 }, vertices, indices: [0, 2, 1, 1, 2, 3] };
}

describe('geometry triangles', () => {
  it('derives flat normals for box walls (90 degree creases are kept)', () => {
    const { vertices, ranges } = buildGeometryVertices(scene(boxMesh([0, 0, 0], [2, 1, 1])));
    expect(vertices.size()).toBe(36);
    expect(ranges).toEqual([{ meshIndex: 0, apiIndex: 0, start: 0, count: 36 }]);
    const data = vertices.data();
    for (let v = 0; v < 36; v += 3) {
      const n = normalAt(data, v);
      expect(n.length()).toBeCloseTo(1, 5);
      // Each triangle's vertices share its face normal (axis aligned).
      expect(Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z))).toBeCloseTo(1, 5);
    }
  });

  it('blends normals across gentle folds', () => {
    const { vertices } = buildGeometryVertices(scene(foldedPair(20)));
    const data = vertices.data();
    // Vertex 1 of the first triangle (index 2 = shared (1,0,0)) is blended: not the face normal (0,0,±1).
    const shared = normalAt(data, 1);
    expect(Math.abs(shared.z)).toBeLessThan(0.999);
    // The opposite, unshared corner keeps its own face normal.
    expect(Math.abs(normalAt(data, 0).z)).toBeCloseTo(1, 5);
  });

  it('keeps makeFacettedCylinder flat', () => {
    const { vertices } = buildGeometryVertices(scene(foldedPair(20, 'makeFacettedCylinder')));
    expect(Math.abs(normalAt(vertices.data(), 1).z)).toBeCloseTo(1, 5);
  });

  it('skips degenerate and out-of-range triangles', () => {
    const mesh = boxMesh([0, 0, 0], [1, 1, 1]);
    mesh.indices = [0, 1, 1, 0, 1, 99, 0, 1, 2];
    const { vertices } = buildGeometryVertices(scene(mesh));
    expect(vertices.size()).toBe(3);
  });

  it('stamps the mesh color on every vertex', () => {
    const { vertices } = buildGeometryVertices(scene(boxMesh([0, 0, 0], [1, 1, 1])));
    const data = vertices.data();
    expect([data[3], data[4], data[5]]).toEqual([1, Math.fround(176 / 255), 0]);
  });
});

describe('feature edges', () => {
  it('omits the coplanar quad diagonals of a box', () => {
    const { vertices, ranges } = buildGeometryWireVertices(scene(boxMesh([0, 0, 0], [3, 2, 1])));
    // 12 box edges, no diagonals.
    expect(vertices.size()).toBe(24);
    expect(ranges[0].count).toBe(24);
    const data = vertices.data();
    for (let v = 0; v < 24; v += 2) {
      const a = new QVector3D(data[v * 9], data[v * 9 + 1], data[v * 9 + 2]);
      const b = new QVector3D(data[(v + 1) * 9], data[(v + 1) * 9 + 1], data[(v + 1) * 9 + 2]);
      const d = b.sub(a);
      // Every edge is axis aligned.
      expect([d.x, d.y, d.z].filter((c) => c !== 0).length).toBe(1);
    }
  });

  it('keeps boundaries and creases, drops flat shared edges', () => {
    expect(buildGeometryWireVertices(scene(foldedPair(0))).vertices.size()).toBe(8); // 4 boundary edges
    expect(buildGeometryWireVertices(scene(foldedPair(30))).vertices.size()).toBe(10); // + the crease
  });

  it('expands wide lines into two triangles per segment', () => {
    const { vertices } = buildGeometryWireVertices(scene(boxMesh([0, 0, 0], [1, 1, 1])));
    const quads = expandLineQuads(vertices.data(), 2, 4);
    expect(quads.length).toBe(2 * 6 * kLineQuadFloats);
    const src = vertices.data();
    // First quad vertex: endpoint A, endpoint B, A's color, corner (0, -1).
    expect(Array.from(quads.slice(0, 11))).toEqual([
      src[18],
      src[19],
      src[20],
      src[27],
      src[28],
      src[29],
      src[21],
      src[22],
      src[23],
      0,
      -1,
    ]);
    // Corners of one segment cover both ends and both sides.
    const corners = [];
    for (let v = 0; v < 6; ++v) corners.push([quads[v * 11 + 9], quads[v * 11 + 10]]);
    expect(corners).toEqual([
      [0, -1],
      [0, 1],
      [1, -1],
      [1, -1],
      [0, 1],
      [1, 1],
    ]);
  });
});

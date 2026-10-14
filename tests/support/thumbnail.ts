import type { PreviewMesh } from '@engine/geometry';

type Point = [number, number, number];
type Segment = [Point, Point];
type Surface = Pick<PreviewMesh, 'vertices' | 'indices' | 'primitive'>;
type Triangle = { points: [Point, Point, Point]; area: number };

const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const side = (a: Point, b: Point, p: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

const interpolate = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Intersect an edge with the triangle's screen-space footprint and the half-space
// behind its surface. This clips hidden portions exactly, rather than sampling a
// raster depth buffer (which leaves spikes and gaps along silhouettes).
function hiddenInterval([a, b]: Segment, triangle: Triangle): [number, number] | null {
  const [p, q, r] = triangle.points;

  const weights = (point: Point): Point => [
    side(q, r, point) / triangle.area,
    side(r, p, point) / triangle.area,
    side(p, q, point) / triangle.area,
  ];

  const wa = weights(a),
    wb = weights(b);
  let start = 0,
    end = 1;

  const clip = (from: number, to: number) => {
    if (from < 0 && to < 0) return false;
    if (from < 0) start = Math.max(start, from / (from - to));
    if (to < 0) end = Math.min(end, from / (from - to));

    return end > start;
  };

  for (let i = 0; i < 3; i++) if (!clip(wa[i], wb[i])) return null;
  const depths: Point = [p[2], q[2], r[2]];
  // Coincident faces must not occlude their own outlines.
  if (!clip(dot(wa, depths) - a[2] - 0.0001, dot(wb, depths) - b[2] - 0.0001)) return null;

  return [start, end];
}

// Offline thumbnail generation only. The browser loads the resulting static SVG.
export function visibleSurfaceThumbnail(meshes: readonly Surface[]): string {
  const project = ({ x, y, z }: { x: number; y: number; z: number }): Point => [
    (x - y) / Math.sqrt(2),
    (x + y) / Math.sqrt(6) - z * Math.sqrt(2 / 3),
    (x + y + z) / Math.sqrt(3),
  ];

  const projected = meshes.map((mesh) => mesh.vertices.map(project));
  const points = projected.flat();
  if (!points.length) throw new Error('Cannot create a thumbnail of empty geometry');
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const scale = Math.min(144 / Math.max(maxX - minX, 1e-9), 96 / Math.max(maxY - minY, 1e-9));
  const offsetX = (160 - (maxX - minX) * scale) / 2,
    offsetY = (112 - (maxY - minY) * scale) / 2;
  const triangles: Triangle[] = [],
    candidates: Segment[] = [];

  const positionKey = (p: Point) => p.map((n) => n.toFixed(5)).join(',');

  meshes.forEach((mesh, meshIndex) => {
    const vertices = projected[meshIndex].map(([x, y, z]): Point => [
      (x - minX) * scale + offsetX,
      (y - minY) * scale + offsetY,
      z * scale,
    ]);
    if (mesh.primitive === 'lines') {
      for (let i = 0; i < mesh.indices.length; i += 2)
        candidates.push([vertices[mesh.indices[i]], vertices[mesh.indices[i + 1]]]);

      return;
    }
    const edges = new Map<string, { segment: Segment; normals: Point[] }>();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => vertices[index]);
      const normal = cross(subtract(b, a), subtract(c, a));
      const length = Math.hypot(...normal);
      if (length < 1e-10) continue;
      const area = side(a, b, c);
      if (Math.abs(area) > 1e-10) triangles.push({ points: [a, b, c], area });
      for (const [start, end] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const key = [positionKey(start), positionKey(end)].sort().join(';');
        const edge = edges.get(key) ?? { segment: [start, end], normals: [] };
        edge.normals.push(normal.map((n) => n / length) as Point);
        edges.set(key, edge);
      }
    }
    for (const { segment, normals } of edges.values()) {
      const first = normals[0];
      const crease = normals.some((n) => Math.abs(dot(n, first)) < Math.cos(Math.PI / 6));
      const silhouette = normals.some((n) => Math.abs(dot(n, first)) < 0.99999 && n[2] * first[2] < 0);
      if (normals.length === 1 || crease || silhouette) candidates.push(segment);
    }
  });

  const cells = (points: readonly Point[]): string[] => {
    const keys: string[] = [];
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    for (let x = Math.floor(Math.min(...xs) / 8); x <= Math.floor(Math.max(...xs) / 8); x++)
      for (let y = Math.floor(Math.min(...ys) / 8); y <= Math.floor(Math.max(...ys) / 8); y++) keys.push(`${x},${y}`);

    return keys;
  };

  const grid = new Map<string, Triangle[]>();
  for (const triangle of triangles)
    for (const cell of cells(triangle.points)) {
      const bucket = grid.get(cell) ?? [];
      bucket.push(triangle);
      grid.set(cell, bucket);
    }
  const paths = new Map<string, string>();

  const format = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

  const append = (a: Point, b: Point) => {
    const start = format(a),
      end = format(b);
    if (start !== end) paths.set([start, end].sort().join(';'), `M${start}L${end}`);
  };

  for (const segment of candidates) {
    const nearby = new Set(cells(segment).flatMap((cell) => grid.get(cell) ?? []));
    const hidden = [...nearby]
      .flatMap((triangle) => {
        const interval = hiddenInterval(segment, triangle);

        return interval ? [interval] : [];
      })
      .sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    const [a, b] = segment;
    for (const [start, end] of hidden) {
      if (start > cursor) append(interpolate(a, b, cursor), interpolate(a, b, start));
      cursor = Math.max(cursor, end);
      if (cursor >= 1) break;
    }
    if (cursor < 1) append(interpolate(a, b, cursor), b);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 112"><path fill="none" stroke="#16a34a" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round" d="${[...paths.values()].join('')}"/></svg>\n`;
}

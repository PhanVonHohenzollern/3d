import earcut from 'earcut';
import { DVec3, length } from '@engine/math/DVec3';
import { buildPolygonFaceMesh } from '@engine/geometry/builders/rectangularMeshes';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { toPoint } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewGeometryScene } from '@engine/geometry/previewScene';
import { appendStroke } from '@engine/geometry/adapters/symbolAdapters';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';

// Center lines preview as dashes, like dashed lines.
type LineStyle = 'solid' | 'dashed' | 'zigzag';

type ArcOptions = {
  outline: 'solid' | 'dashed' | 'filled' | 'filledIfOccupied';
  // 'diam' is a diameter, the others are radii.
  size?: 'rad' | 'd' | 'diam';
  startAngle?: 'bang' | 'startAng';
  zigzag?: boolean;
};

// What every planar builder shares: the arguments and the two ways of drawing a shape.
class PlanarSketch {
  constructor(
    readonly scene: PreviewGeometryScene,
    readonly context: MeshBuildContext,
    readonly a: NamedArguments,
  ) {}

  stroke(p: DVec3[], closed = false): void {
    appendStroke(this.scene, this.context, p, closed);
  }

  fill(p: DVec3[]): void {
    this.scene.meshes.push(buildPolygonFaceMesh(this.context, p.map(toPoint)));
  }
}

function planar(build: (s: PlanarSketch) => void): ApiMeshAdapter {
  return withAdapterErrors('invalid planar geometry', (scene, context, args) =>
    build(new PlanarSketch(scene, context, new NamedArguments(context, args))),
  );
}

function boardHatch(s: PlanarSketch): void {
  const { a } = s;
  const points = a.points('pt').slice(0, a.count('n', 3, 4096)),
    hole = a.get('hpt') === undefined ? [] : a.points('hpt').slice(0, a.count('hn', 3, 4096));
  const mesh = s.context.createMesh(),
    all = [...points, ...hole];
  mesh.vertices = all.map((p) => vertex(p, new DVec3(0, 0, 1)));
  mesh.indices = earcut(
    all.flatMap((p) => [p.x, p.y]),
    hole.length ? [points.length] : undefined,
  );
  s.scene.meshes.push(mesh);
}

function polygon(s: PlanarSketch, look: 'outline' | 'filled'): void {
  const { a } = s;
  const p = ['p1', 'p2', 'p3', 'p4'].filter((n) => a.get(n) !== undefined).map((n) => a.vector(n));
  if (look === 'filled') s.fill(p);
  else s.stroke(p, true);
}

function line(s: PlanarSketch, style: LineStyle): void {
  const { a } = s;
  const p = a.vector('p1'),
    q = a.vector('p2'),
    delta = q.sub(p),
    distance = length(delta);
  if (style === 'zigzag') {
    const count = Math.max(2, Math.min(512, Math.ceil(distance / 5))),
      side = new DVec3(-delta.y, delta.x, 0).div(Math.max(distance, 1e-9));
    s.stroke(
      Array.from({ length: count + 1 }, (_, i) =>
        p.add(delta.mul(i / count)).add(side.mul(i === 0 || i === count ? 0 : i % 2 ? 2 : -2)),
      ),
    );
  } else if (style === 'dashed') {
    const count = Math.max(1, Math.min(2048, Math.ceil(distance / 12)));
    for (let i = 0; i < count; ++i) s.stroke([p.add(delta.mul(i / count)), p.add(delta.mul((i + 0.65) / count))]);
  } else s.stroke([p, q]);
}

function arc(s: PlanarSketch, { outline, size = 'rad', startAngle = 'bang', zigzag = false }: ArcOptions): void {
  const { a } = s;
  const center = a.vector('pt', 'p1'),
    radius = a.positive(size) / (size === 'diam' ? 2 : 1);
  const scale = a.num('scl', 1),
    begin = a.num(startAngle, 0),
    end = a.num('fang', Math.PI * 2),
    rotation = a.num('ang', 0);
  // ads_* planar API angles follow AutoCAD radians, unlike 3D symbolic arcs.
  const count = Math.max(8, Math.min(2048, Math.ceil(Math.abs(end - begin) * 24)));
  const p = Array.from({ length: count + 1 }, (_, i) => {
    const t = begin + ((end - begin) * i) / count,
      r = radius * (zigzag ? (i % 2 ? 1.03 : 0.97) : 1),
      x = r * Math.cos(t),
      y = r * scale * Math.sin(t);

    return center.add(
      new DVec3(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation), 0),
    );
  });
  if (outline === 'filled' || (outline === 'filledIfOccupied' && a.bool('occupied'))) s.fill(p);
  else if (outline === 'dashed') {
    for (let i = 0; i < count; i += 6) s.stroke(p.slice(i, Math.min(count + 1, i + 4)));
  } else s.stroke(p);
}

export const planarAdapters: AdapterTable = {
  make_board_hatch: planar(boardHatch),

  make_polygon: planar((s) => polygon(s, 'outline')),
  make_thin_polygon: planar((s) => polygon(s, 'outline')),
  make_thin_hatch: planar((s) => polygon(s, 'filled')),

  make_line: planar((s) => line(s, 'solid')),
  make_thin_line: planar((s) => line(s, 'solid')),
  make_wide_line: planar((s) => line(s, 'solid')),
  make_connector_line: planar((s) => line(s, 'solid')),
  make_dashed_line: planar((s) => line(s, 'dashed')),
  make_center_line: planar((s) => line(s, 'dashed')),
  make_zigzag_line: planar((s) => line(s, 'zigzag')),

  make_arc: planar((s) => arc(s, { outline: 'solid' })),
  make_circle: planar((s) => arc(s, { outline: 'solid' })),
  make_connector_circle: planar((s) => arc(s, { outline: 'solid' })),
  make_scld_arc: planar((s) => arc(s, { outline: 'solid' })),
  make_ellipse: planar((s) => arc(s, { outline: 'solid' })),
  make_connector_ellipse: planar((s) => arc(s, { outline: 'solid' })),
  make_thin_circle: planar((s) => arc(s, { outline: 'solid' })),
  make_thin_arc: planar((s) => arc(s, { outline: 'solid' })),
  make_thin_scld_arc: planar((s) => arc(s, { outline: 'solid' })),
  make_thin_ellipse: planar((s) => arc(s, { outline: 'solid' })),
  make_dashed_arc: planar((s) => arc(s, { outline: 'dashed' })),
  make_dashed_circle: planar((s) => arc(s, { outline: 'dashed' })),
  make_dashed_connector_circle: planar((s) => arc(s, { outline: 'dashed' })),
  make_dashed_ellipse: planar((s) => arc(s, { outline: 'dashed' })),
  make_dashed_connector_ellipse: planar((s) => arc(s, { outline: 'dashed' })),
  make_scld_dashed_arc: planar((s) => arc(s, { outline: 'dashed' })),
  make_center_arc: planar((s) => arc(s, { outline: 'dashed' })),
  make_center_scld_arc: planar((s) => arc(s, { outline: 'dashed' })),
  make_zigzag_arc: planar((s) => arc(s, { outline: 'solid', zigzag: true })),
  make_filled_circle: planar((s) => arc(s, { outline: 'filled' })),
  make_thin_filled_circle: planar((s) => arc(s, { outline: 'filled' })),
  make_fvalve_hatch: planar((s) => arc(s, { outline: 'filled', size: 'd' })),
  make_connector_glyph: planar((s) => arc(s, { outline: 'filledIfOccupied', size: 'diam', startAngle: 'startAng' })),
};

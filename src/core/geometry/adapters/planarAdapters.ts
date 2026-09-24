import earcut from 'earcut';
import { DVec3, length } from '../../../utils/DVec3';
import { allNativeApiSignatures } from '../../runtime/ApiMetadata';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { buildPolygonFaceMesh } from '../builders/rectangularMeshes';
import { warningFor } from '../helpers/apiCall';
import { toPoint } from '../helpers/geometryMath';
import { vertex } from '../helpers/meshData';
import { NamedArguments } from '../helpers/NamedArguments';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';
import { appendStroke } from './symbolAdapters';

export const planarApiNames = [
  ...new Set(
    allNativeApiSignatures()
      .filter((s) => s.sourceHeader === 'PnGeometry.h' && s.name.startsWith('make_'))
      .map((s) => s.name),
  ),
];

export function appendPlanar(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  try {
    const a = new NamedArguments(context, args),
      name = context.call.name;

    const stroke = (p: DVec3[], closed = false) => appendStroke(scene, context, p, closed);

    const fill = (p: DVec3[]) => scene.meshes.push(buildPolygonFaceMesh(context, p.map(toPoint)));

    if (name === 'make_board_hatch') {
      const points = a.points('pt').slice(0, a.count('n', 3, 4096)),
        hole = a.get('hpt') === undefined ? [] : a.points('hpt').slice(0, a.count('hn', 3, 4096));
      const mesh = context.createMesh(),
        all = [...points, ...hole];
      mesh.vertices = all.map((p) => vertex(p, new DVec3(0, 0, 1)));
      mesh.indices = earcut(
        all.flatMap((p) => [p.x, p.y]),
        hole.length ? [points.length] : undefined,
      );
      scene.meshes.push(mesh);

      return true;
    }
    if (name.includes('polygon') || name === 'make_thin_hatch') {
      const p = ['p1', 'p2', 'p3', 'p4'].filter((n) => a.get(n) !== undefined).map((n) => a.vector(n));
      if (name.includes('hatch')) fill(p);
      else stroke(p, true);

      return true;
    }
    if (name.endsWith('_line')) {
      const p = a.vector('p1'),
        q = a.vector('p2'),
        delta = q.sub(p),
        distance = length(delta);
      if (name.includes('zigzag')) {
        const count = Math.max(2, Math.min(512, Math.ceil(distance / 5))),
          side = new DVec3(-delta.y, delta.x, 0).div(Math.max(distance, 1e-9));
        stroke(
          Array.from({ length: count + 1 }, (_, i) =>
            p.add(delta.mul(i / count)).add(side.mul(i === 0 || i === count ? 0 : i % 2 ? 2 : -2)),
          ),
        );
      } else if (name.includes('dashed') || name.includes('center')) {
        const count = Math.max(1, Math.min(2048, Math.ceil(distance / 12)));
        for (let i = 0; i < count; ++i) stroke([p.add(delta.mul(i / count)), p.add(delta.mul((i + 0.65) / count))]);
      } else stroke([p, q]);

      return true;
    }
    const center = a.vector('pt', 'p1'),
      radius =
        a.positive(name === 'make_fvalve_hatch' ? 'd' : name === 'make_connector_glyph' ? 'diam' : 'rad') /
        (name === 'make_connector_glyph' ? 2 : 1);
    const scale = a.num('scl', 1),
      begin = a.num(name === 'make_connector_glyph' ? 'startAng' : 'bang', 0),
      end = a.num('fang', Math.PI * 2),
      rotation = a.num('ang', 0);
    // ads_* planar API angles follow AutoCAD radians, unlike 3D symbolic arcs.
    const count = Math.max(8, Math.min(2048, Math.ceil(Math.abs(end - begin) * 24)));
    const p = Array.from({ length: count + 1 }, (_, i) => {
      const t = begin + ((end - begin) * i) / count,
        r = radius * (name.includes('zigzag') ? (i % 2 ? 1.03 : 0.97) : 1),
        x = r * Math.cos(t),
        y = r * scale * Math.sin(t);

      return center.add(
        new DVec3(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation), 0),
      );
    });
    if (
      name.includes('filled') ||
      name === 'make_fvalve_hatch' ||
      (name === 'make_connector_glyph' && a.bool('occupied'))
    )
      fill(p);
    else if (name.includes('dashed') || name.includes('center')) {
      for (let i = 0; i < count; i += 6) stroke(p.slice(i, Math.min(count + 1, i + 4)));
    } else stroke(p);

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid planar geometry'));

    return true;
  }
}

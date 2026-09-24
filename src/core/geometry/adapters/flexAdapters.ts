import { DVec3, length, normalized } from '../../../utils/DVec3';
import type { RuntimeValue } from '../../runtime/RuntimeValue';
import { warningFor } from '../helpers/apiCall';
import { basisFromUp, stableBasis } from '../helpers/geometryMath';
import { vertex } from '../helpers/meshData';
import { NamedArguments } from '../helpers/NamedArguments';
import type { MeshBuildContext } from '../MeshBuildContext';
import type { PreviewGeometryScene } from '../previewScene';

export const flexApiNames = ['makeFlex', 'makeFlexRectR', 'makeFlexRectO', 'makeFlexRectA'];

export function appendFlex(scene: PreviewGeometryScene, context: MeshBuildContext, args: RuntimeValue[]): boolean {
  try {
    const a = new NamedArguments(context, args);
    if (a.get('ctrlPnts') === undefined)
      throw new Error('AcDbCurve overload requires a native CAD curve; use the control-point overload for preview');
    const count = a.count('numCtrlPnts', 2, 4096),
      controls = a.points('ctrlPnts').slice(0, count);
    if (controls.length !== count || count < 2) throw new Error('flex needs at least two control points');
    const pitch = a.positive('crestDist'),
      connectorLength = Math.max(0, a.num('connLen'));
    const samples: DVec3[] = [];

    // Interpolating cubic Hermite curve. End tangents are honoured when supplied.
    const tangent = (i: number) => {
      if (i === 0 && a.get('startTang') !== undefined) return a.vector('startTang');
      if (i === count - 1 && a.get('endTang') !== undefined) return a.vector('endTang');

      return controls[Math.min(count - 1, i + 1)]
        .sub(controls[Math.max(0, i - 1)])
        .mul(i === 0 || i === count - 1 ? 1 : 0.5);
    };

    const steps = Math.max(
      4,
      Math.min(
        256,
        Math.ceil(
          ((controls.slice(1).reduce((sum, p, i) => sum + length(p.sub(controls[i])), 0) / pitch) * 8) / (count - 1),
        ),
      ),
    );
    if ((count - 1) * steps > 4096) throw new Error('flex sampling exceeds 4096 sections');
    for (let i = 0; i < count - 1; ++i)
      for (let j = 0; j < steps; ++j) {
        const t = j / steps,
          t2 = t * t,
          t3 = t2 * t;
        samples.push(
          controls[i]
            .mul(2 * t3 - 3 * t2 + 1)
            .add(tangent(i).mul(t3 - 2 * t2 + t))
            .add(controls[i + 1].mul(-2 * t3 + 3 * t2))
            .add(tangent(i + 1).mul(t3 - t2)),
        );
      }
    samples.push(controls.at(-1)!);
    const distances = [0];
    for (let i = 1; i < samples.length; ++i) distances.push(distances[i - 1] + length(samples[i].sub(samples[i - 1])));
    const total = distances.at(-1)!;
    if (total <= 1e-9) throw new Error('flex path has zero length');
    const circular = context.call.name === 'makeFlex';
    const w0 = a.positive(circular ? 'lowerCrestDiam' : 'lowerCrestWidth'),
      w1 = a.positive(circular ? 'upperCrestDiam' : 'upperCrestWidth');
    const h0 = circular ? w0 : a.positive('lowerCrestHeight'),
      h1 = circular ? w1 : a.positive('upperCrestHeight');
    const wc = a.positive(circular ? 'connDiam' : 'connWidth'),
      hc = circular ? wc : a.positive('connHeight');
    const around = Math.min(256, 4 * a.count('n')),
      mesh = context.createMesh();
    let up = stableBasis(normalized(samples[1].sub(samples[0])))[0];
    for (let i = 0; i < samples.length; ++i) {
      const axis = normalized(samples[Math.min(i + 1, samples.length - 1)].sub(samples[Math.max(0, i - 1)]));
      const [nextUp, right] = basisFromUp(axis, up);
      up = nextUp;
      const d = distances[i],
        onConnector = d <= connectorLength || total - d <= connectorLength;
      const wave = (1 - Math.cos((2 * Math.PI * (d - connectorLength)) / pitch)) / 2;
      const w = (onConnector ? wc : w0 + (w1 - w0) * wave) / 2,
        h = (onConnector ? hc : h0 + (h1 - h0) * wave) / 2;
      for (let j = 0; j < around; ++j) {
        const theta = (2 * Math.PI * j) / around;
        let x = Math.cos(theta),
          y = Math.sin(theta);
        if (context.call.name === 'makeFlexRectR') {
          const scale = 1 / Math.max(Math.abs(x), Math.abs(y));
          x *= scale;
          y *= scale;
        } else if (context.call.name === 'makeFlexRectA') {
          x = Math.sign(x) * Math.sqrt(Math.abs(x));
          y = Math.sign(y) * Math.sqrt(Math.abs(y));
        }
        const radial = right.mul(w * x).add(up.mul(h * y));
        mesh.vertices.push(vertex(samples[i].add(radial), normalized(radial)));
      }
    }
    for (let i = 0; i < samples.length - 1; ++i)
      for (let j = 0; j < around; ++j) {
        const k = (j + 1) % around,
          b = i * around,
          c = (i + 1) * around;
        mesh.indices.push(b + j, b + k, c + k, b + j, c + k, c + j);
      }
    // Compute smooth normals in the renderer, accounting for changing crests.
    scene.meshes.push(mesh);

    return true;
  } catch (error) {
    scene.warnings.push(warningFor(context.call, error instanceof Error ? error.message : 'invalid flex'));

    return true;
  }
}

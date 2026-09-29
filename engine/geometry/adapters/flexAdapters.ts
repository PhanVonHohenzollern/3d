import { DVec3, length, normalized } from '@engine/math';
import type { AdapterTable, ApiMeshAdapter } from '@engine/geometry/adapters/types';
import { withAdapterErrors } from '@engine/geometry/helpers/adapterErrors';
import { basisFromUp, stableBasis } from '@engine/geometry/helpers/geometryMath';
import { vertex } from '@engine/geometry/helpers/meshData';
import { NamedArguments } from '@engine/geometry/helpers/NamedArguments';
import type { MeshBuildContext } from '@engine/geometry/MeshBuildContext';
import type { PreviewMesh } from '@engine/geometry/previewScene';
import { kMaxListLength, kMaxRingSegments } from '@engine/geometry/config/previewConstants';

// The sampled centre line every flex hose is swept along.
type FlexPath = {
  samples: DVec3[];
  distances: number[];
  total: number;
  pitch: number;
  connectorLength: number;
};

// Crest and connector sizes of the cross-section, and the outline mapping a unit circle point to it.
type FlexSection = {
  w0: number;
  w1: number;
  h0: number;
  h1: number;
  wc: number;
  hc: number;
  outline: (x: number, y: number) => [number, number];
};

function flex(section: (a: NamedArguments) => FlexSection): ApiMeshAdapter {
  return withAdapterErrors('invalid flex', (scene, context, args) => {
    const a = new NamedArguments(context, args);
    const path = flexPath(a);
    scene.meshes.push(sweep(context, a, path, section(a)));
  });
}

function flexPath(a: NamedArguments): FlexPath {
  if (a.get('ctrlPnts') === undefined)
    throw new Error('AcDbCurve overload requires a native CAD curve; use the control-point overload for preview');
  const count = a.count('numCtrlPnts', 2, kMaxListLength),
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
  if ((count - 1) * steps > kMaxListLength) throw new Error(`flex sampling exceeds ${kMaxListLength} sections`);
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

  return { samples, distances, total, pitch, connectorLength };
}

function sweep(context: MeshBuildContext, a: NamedArguments, path: FlexPath, s: FlexSection): PreviewMesh {
  const { samples, distances, total, pitch, connectorLength } = path;
  const around = Math.min(kMaxRingSegments, 4 * a.count('n')),
    mesh = context.createMesh();
  let up = stableBasis(normalized(samples[1].sub(samples[0])))[0];
  for (let i = 0; i < samples.length; ++i) {
    const axis = normalized(samples[Math.min(i + 1, samples.length - 1)].sub(samples[Math.max(0, i - 1)]));
    const [nextUp, right] = basisFromUp(axis, up);
    up = nextUp;
    const d = distances[i],
      onConnector = d <= connectorLength || total - d <= connectorLength;
    const wave = (1 - Math.cos((2 * Math.PI * (d - connectorLength)) / pitch)) / 2;
    const w = (onConnector ? s.wc : s.w0 + (s.w1 - s.w0) * wave) / 2,
      h = (onConnector ? s.hc : s.h0 + (s.h1 - s.h0) * wave) / 2;
    for (let j = 0; j < around; ++j) {
      const theta = (2 * Math.PI * j) / around;
      const [x, y] = s.outline(Math.cos(theta), Math.sin(theta));
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
  return mesh;
}

function round(a: NamedArguments): FlexSection {
  const w0 = a.positive('lowerCrestDiam'),
    w1 = a.positive('upperCrestDiam'),
    wc = a.positive('connDiam');

  return { w0, w1, h0: w0, h1: w1, wc, hc: wc, outline: (x, y) => [x, y] };
}

// R squares the circle, O keeps the ellipse, A pulls it towards the corners.
const rectOutlines = {
  R: (x: number, y: number): [number, number] => {
    const scale = 1 / Math.max(Math.abs(x), Math.abs(y));

    return [x * scale, y * scale];
  },
  O: (x: number, y: number): [number, number] => [x, y],
  A: (x: number, y: number): [number, number] => [
    Math.sign(x) * Math.sqrt(Math.abs(x)),
    Math.sign(y) * Math.sqrt(Math.abs(y)),
  ],
};

function rectFlex(a: NamedArguments, corners: keyof typeof rectOutlines): FlexSection {
  const w0 = a.positive('lowerCrestWidth'),
    w1 = a.positive('upperCrestWidth');
  const h0 = a.positive('lowerCrestHeight'),
    h1 = a.positive('upperCrestHeight');
  const wc = a.positive('connWidth'),
    hc = a.positive('connHeight');

  return { w0, w1, h0, h1, wc, hc, outline: rectOutlines[corners] };
}

export const flexAdapters: AdapterTable = {
  makeFlex: flex(round),
  makeFlexRectR: flex((a) => rectFlex(a, 'R')),
  makeFlexRectO: flex((a) => rectFlex(a, 'O')),
  makeFlexRectA: flex((a) => rectFlex(a, 'A')),
};

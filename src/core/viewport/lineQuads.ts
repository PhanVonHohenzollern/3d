import { kVertexFloats } from './VertexArray';

export const kLineQuadFloats = 11;
export const kLineQuadBytes = kLineQuadFloats * 4;
export const kLineQuadVerticesPerSegment = 6;
export const kLineQuadVerticesPerVertex = kLineQuadVerticesPerSegment / 2;

const kCorners: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [1, -1],
  [1, -1],
  [0, 1],
  [1, 1],
];

export function expandLineQuads(src: Float32Array, first: number, count: number): Float32Array {
  const segments = Math.floor(count / 2);
  const out = new Float32Array(segments * kLineQuadVerticesPerSegment * kLineQuadFloats);
  let o = 0;
  for (let s = 0; s < segments; ++s) {
    const a = (first + s * 2) * kVertexFloats;
    const b = a + kVertexFloats;
    for (const [t, side] of kCorners) {
      const c = t === 0 ? a : b;
      out[o++] = src[a];
      out[o++] = src[a + 1];
      out[o++] = src[a + 2];
      out[o++] = src[b];
      out[o++] = src[b + 1];
      out[o++] = src[b + 2];
      out[o++] = src[c + 3];
      out[o++] = src[c + 4];
      out[o++] = src[c + 5];
      out[o++] = t;
      out[o++] = side;
    }
  }

  return out;
}

import { QVector3D } from '../../utils/Vector3D';

export const kVertexFloats = 9;
export const kVertexBytes = kVertexFloats * 4;

export class VertexArray {
  private m_data: Float32Array;
  private m_size = 0;

  constructor(capacity = 64) {
    this.m_data = new Float32Array(Math.max(1, capacity) * kVertexFloats);
  }

  size(): number {
    return this.m_size;
  }
  empty(): boolean {
    return this.m_size === 0;
  }

  clear(): void {
    this.m_size = 0;
  }

  data(): Float32Array {
    return this.m_data.subarray(0, this.m_size * kVertexFloats);
  }

  private reserve(vertices: number): void {
    if (vertices * kVertexFloats <= this.m_data.length) return;
    let capacity = this.m_data.length / kVertexFloats;
    while (capacity < vertices) capacity *= 2;
    const grown = new Float32Array(capacity * kVertexFloats);
    grown.set(this.data());
    this.m_data = grown;
  }

  push(px: number, py: number, pz: number, r: number, g: number, b: number, nx: number, ny: number, nz: number): void {
    this.reserve(this.m_size + 1);
    const o = this.m_size * kVertexFloats;
    const d = this.m_data;
    d[o] = px;
    d[o + 1] = py;
    d[o + 2] = pz;
    d[o + 3] = r;
    d[o + 4] = g;
    d[o + 5] = b;
    d[o + 6] = nx;
    d[o + 7] = ny;
    d[o + 8] = nz;
    ++this.m_size;
  }

  appendData(src: Float32Array): void {
    const count = src.length / kVertexFloats;
    this.reserve(this.m_size + count);
    this.m_data.set(src, this.m_size * kVertexFloats);
    this.m_size += count;
  }

  appendLine(a: QVector3D, b: QVector3D, r: number, g: number, bColor: number): void {
    this.push(a.x, a.y, a.z, r, g, bColor, 0, 0, 1);
    this.push(b.x, b.y, b.z, r, g, bColor, 0, 0, 1);
  }

  assign(other: VertexArray): void {
    this.m_size = 0;
    this.appendData(other.data());
  }

  position(i: number): QVector3D {
    const o = i * kVertexFloats;
    return new QVector3D(this.m_data[o], this.m_data[o + 1], this.m_data[o + 2]);
  }
}

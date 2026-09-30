import type { QMatrix4x4 } from '@/widgets/viewport/lib/math/Matrix4x4';
import type { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { GpuVertexLayout } from '@/widgets/viewport/lib/render/types';
import type { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';

// What a backend tells the viewport about its device.
export interface RenderBackendEvents {
  // The backend can draw now: after attach (at once, or later for an async device) and after a
  // lost device comes back. Buffers must be uploaded again.
  ready(): void;
  // The device is gone; nothing draws until the next ready().
  lost(): void;
}

// The GPU side of the viewport (the implementor of a Bridge whose abstraction is SceneRenderer).
// SceneRenderer decides what to draw and in which order; a backend owns the device and turns
// those calls into GPU work. State set here applies to every draw after it, until changed.
export interface RenderBackend {
  attach(canvas: HTMLCanvasElement, events: RenderBackendEvents): void;
  detach(): void;

  // Uploads the frame's vertices; false when the device is not ready.
  uploadVertexData(vertices: VertexArray, layout: GpuVertexLayout, geometryVersion: number): boolean;

  // Starts a frame with depth test and depth writes on and no blending; false when it cannot draw.
  beginFrame(): boolean;
  endFrame(): void;

  setMatrices(mvp: QMatrix4x4, normalMatrix: Float32Array): void;
  setDepthTest(enabled: boolean): void;
  setDepthMask(enabled: boolean): void;
  // Below 1, draws blend over what is already drawn.
  setOpacity(opacity: number): void;
  setUseOverrideColor(enabled: boolean): void;
  setOverrideColor(color: QVector3D): void;
  setLightingEnabled(enabled: boolean): void;
  // Line width in pixels.
  setLineWidth(width: number): void;

  // Vertex ranges of the uploaded buffer: pairs of vertices for lines, triples for triangles.
  drawLines(first: number, count: number): void;
  drawTriangles(first: number, count: number): void;
}

import type { QMatrix4x4 } from '@/widgets/viewport/lib/math/Matrix4x4';
import type { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { RenderBackend, RenderBackendEvents } from '@/widgets/viewport/lib/render/backend/RenderBackend';
import type { ViewportSurface } from '@/widgets/viewport/lib/render/types';
import type { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';

const color = (c: QVector3D) => [c.x, c.y, c.z].map((v) => Number(v.toFixed(4))).join(',');

// A backend that draws nothing and logs every call made during a frame, one string per call.
export class RecordingBackend implements RenderBackend {
  readonly frames: string[][] = [];
  events: RenderBackendEvents | null = null;
  uploads = 0;
  #frame: string[] | null = null;

  attach(_canvas: HTMLCanvasElement, events: RenderBackendEvents): void {
    this.events = events;
    events.ready();
  }

  detach(): void {}

  uploadVertexData(_vertices: VertexArray, _layout: unknown, _geometryVersion: number): boolean {
    ++this.uploads;

    return true;
  }

  beginFrame(): boolean {
    this.#frame = [];

    return true;
  }

  endFrame(): void {
    if (this.#frame) this.frames.push(this.#frame);
    this.#frame = null;
  }

  setMatrices(_mvp: QMatrix4x4, _normalMatrix: Float32Array): void {
    this.#log('matrices');
  }

  setDepthTest(enabled: boolean): void {
    this.#log(`depthTest ${enabled}`);
  }

  setDepthMask(enabled: boolean): void {
    this.#log(`depthMask ${enabled}`);
  }

  setOpacity(opacity: number): void {
    this.#log(`opacity ${opacity}`);
  }

  setUseOverrideColor(enabled: boolean): void {
    this.#log(`useOverrideColor ${enabled}`);
  }

  setOverrideColor(value: QVector3D): void {
    this.#log(`overrideColor ${color(value)}`);
  }

  setLightingEnabled(enabled: boolean): void {
    this.#log(`lighting ${enabled}`);
  }

  setLineWidth(width: number): void {
    this.#log(`lineWidth ${width}`);
  }

  drawLines(first: number, count: number): void {
    this.#log(`lines ${first} ${count}`);
  }

  drawTriangles(first: number, count: number): void {
    this.#log(`triangles ${first} ${count}`);
  }

  #log(call: string): void {
    this.#frame?.push(call);
  }
}

// A surface without real canvases: the backend ignores them and the overlay has no 2D context.
export function fakeSurface(): ViewportSurface {
  const canvas = () =>
    ({
      width: 0,
      height: 0,
      getContext: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as HTMLCanvasElement;

  return {
    glCanvas: canvas(),
    overlay: canvas(),
    cursorElement: { style: { cursor: '' } } as HTMLElement,
    fontFamily: '',
    fontPixelSize: 12,
  };
}

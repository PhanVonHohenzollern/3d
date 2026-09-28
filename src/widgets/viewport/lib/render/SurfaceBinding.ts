import { approximateTextMeasurer, CanvasTextMeasurer, kDefaultFontFamily, pointSizeToPixels } from '@/shared/lib/text';
import { kWidgetFontPointSize } from '@/widgets/viewport/config/viewport';
import { QRect } from '@/widgets/viewport/lib/math/Rect';
import type { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import type { OverlayLayer } from '@/widgets/viewport/lib/render/OverlayLayer';
import type { SceneRenderer } from '@/widgets/viewport/lib/render/SceneRenderer';
import type { ViewportSurface } from '@/widgets/viewport/lib/render/types';

// What the surface needs from the viewport that owns it.
export interface SurfaceHost {
  // Fills the vertex buffer when GL starts with nothing built.
  rebuildVertices(): void;
  clearHover(): void;
}

// The canvases the viewport draws on: the WebGL context and its loss, the 2D overlay context,
// the size and pixel ratio, the cursor, and painting on the next animation frame.
export class SurfaceBinding {
  #gl: WebGL2RenderingContext | null = null;
  #surface: ViewportSurface | null = null;
  #overlayContext: CanvasRenderingContext2D | null = null;
  #width = 0;
  #height = 0;
  #devicePixelRatio = 1;
  #updateFrame: number | null = null;
  #cursor = '';

  constructor(
    private readonly view: CameraController,
    private readonly overlay: OverlayLayer,
    private readonly scene: SceneRenderer,
    private readonly host: SurfaceHost,
  ) {}

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  bounds(): QRect {
    return new QRect(0, 0, this.#width, this.#height);
  }

  attach(surface: ViewportSurface): void {
    if (this.#surface) this.detach();
    this.#surface = surface;
    this.overlay.setFont(
      surface.fontFamily || kDefaultFontFamily,
      surface.fontPixelSize > 0 ? surface.fontPixelSize : pointSizeToPixels(kWidgetFontPointSize),
    );
    this.#overlayContext = surface.overlay.getContext('2d');
    this.overlay.setTextMeasurer(CanvasTextMeasurer.create() ?? approximateTextMeasurer);
    surface.glCanvas.addEventListener('webglcontextlost', this.#onContextLost);
    surface.glCanvas.addEventListener('webglcontextrestored', this.#onContextRestored);
    this.#gl = surface.glCanvas.getContext('webgl2', {
      antialias: true,
      depth: true,
      stencil: false,
      alpha: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!this.#gl) console.warn('Viewport3D: WebGL2 is not available; only the overlay is drawn.');
    else if (!this.#gl.isContextLost()) this.#initializeGL();
    this.#applyCanvasSize();
    this.setCursor(this.#cursor);
    this.overlay.layout(this.#width, this.#height);
    this.update();
  }

  detach(): void {
    const surface = this.#surface;
    if (!surface) return;
    if (this.#updateFrame !== null && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(this.#updateFrame);
    this.#updateFrame = null;
    surface.glCanvas.removeEventListener('webglcontextlost', this.#onContextLost);
    surface.glCanvas.removeEventListener('webglcontextrestored', this.#onContextRestored);
    this.scene.renderer.release(this.#gl !== null && !this.#gl.isContextLost());
    this.#gl = null;
    this.#overlayContext = null;
    this.#surface = null;
    for (const panel of this.overlay.panels) panel.dispose();
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    this.#width = Math.max(0, Math.round(width));
    this.#height = Math.max(0, Math.round(height));
    this.#devicePixelRatio = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
    this.view.camera.setViewportSize(this.#width, this.#height);
    this.#applyCanvasSize();
    this.view.camera.updateProjectionMatrix(this.view.sceneScale);
    this.host.clearHover();
    this.overlay.layout(this.#width, this.#height);
    this.#paintNow();
  }

  // Paints on the next animation frame.
  update(): void {
    if (!this.#surface || this.#updateFrame !== null || typeof requestAnimationFrame !== 'function') return;
    this.#updateFrame = requestAnimationFrame(() => {
      this.#updateFrame = null;
      this.#paintNow();
    });
  }

  setCursor(cursor: string): void {
    this.#cursor = cursor;
    if (this.#surface && this.#surface.cursorElement.style.cursor !== cursor)
      this.#surface.cursorElement.style.cursor = cursor;
  }

  #initializeGL(): void {
    if (!this.#gl || !this.scene.initialize(this.#gl, () => this.host.rebuildVertices())) return;
    this.view.camera.updateViewMatrix();
  }

  #paintNow(): void {
    if (!this.#surface || this.#width <= 0 || this.#height <= 0) return;
    this.scene.paint();
    if (this.#overlayContext)
      this.overlay.paint(this.#overlayContext, this.#devicePixelRatio, this.#width, this.#height);
  }

  #applyCanvasSize(): void {
    const surface = this.#surface;
    if (!surface) return;
    const w = Math.max(1, Math.round(this.#width * this.#devicePixelRatio));
    const h = Math.max(1, Math.round(this.#height * this.#devicePixelRatio));
    for (const canvas of [surface.glCanvas, surface.overlay]) {
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    }
  }

  #onContextLost = (event: Event): void => {
    event.preventDefault();
    this.scene.renderer.release(false);
  };

  #onContextRestored = (): void => {
    if (!this.#gl || this.#gl.isContextLost()) return;
    this.#initializeGL();
    this.update();
  };
}

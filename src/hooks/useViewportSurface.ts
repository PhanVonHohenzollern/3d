import { useLayoutEffect, type RefObject } from 'react';
import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import { wheelAngleDeltaY } from '../helpers/qtInput';
import { pointSizeToPixels } from '../utils/textMetrics';

export interface ViewportSurfaceRefs {
  hostRef: RefObject<HTMLDivElement | null>;
  glCanvasRef: RefObject<HTMLCanvasElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
}

export function useViewportSurface(engine: ViewportEngine, { hostRef, glCanvasRef, overlayRef }: ViewportSurfaceRefs) {
  useLayoutEffect(() => {
    const host = hostRef.current;
    const glCanvas = glCanvasRef.current;
    const overlay = overlayRef.current;
    if (!host || !glCanvas || !overlay) return;
    const style = getComputedStyle(host);
    engine.attach({
      glCanvas,
      overlay,
      cursorElement: overlay,
      fontFamily: style.fontFamily,
      fontPixelSize: Number.parseFloat(style.fontSize) || pointSizeToPixels(9),
    });

    const measure = () => engine.resize(host.clientWidth, host.clientHeight, window.devicePixelRatio || 1);

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);

    let media: MediaQueryList | null = null;

    const watchDevicePixelRatio = () => {
      media?.removeEventListener('change', onDevicePixelRatioChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', onDevicePixelRatioChange);
    };

    const onDevicePixelRatioChange = () => {
      measure();
      watchDevicePixelRatio();
    };

    watchDevicePixelRatio();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = overlay.getBoundingClientRect();
      engine.wheelEvent({ x: e.clientX - rect.left, y: e.clientY - rect.top, angleDeltaY: wheelAngleDeltaY(e) });
    };

    overlay.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      overlay.removeEventListener('wheel', onWheel);
      media?.removeEventListener('change', onDevicePixelRatioChange);
      observer.disconnect();
      engine.detach();
    };
  }, [engine, hostRef, glCanvasRef, overlayRef]);
}

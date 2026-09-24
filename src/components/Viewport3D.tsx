import { useRef, type Ref } from 'react';
import { useViewport3D } from '../hooks/useViewport3D';
import type { Viewport3DHandle, Viewport3DProps } from '../types/viewport';
import { DebugLabelList } from './DebugLabelList';
import { SelectionModeButton } from './SelectionModeButton';

export function Viewport3D({ ref, ...props }: Viewport3DProps & { ref?: Ref<Viewport3DHandle> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewport = useViewport3D(ref, props, { hostRef, glCanvasRef, overlayRef });

  return (
    <div
      ref={hostRef}
      className="relative size-full min-h-0 min-w-0 overflow-hidden bg-viewport-clear outline-none select-none"
      tabIndex={0}
    >
      <canvas ref={glCanvasRef} className="pointer-events-none absolute inset-0 block size-full" aria-hidden />
      <canvas ref={overlayRef} className="absolute inset-0 block size-full touch-none" {...viewport.overlayHandlers} />
      <DebugLabelList panel={viewport.pointPanel} onEnter={viewport.onChildEnter} onFocus={viewport.onChildFocus} />
      <DebugLabelList panel={viewport.vectorPanel} onEnter={viewport.onChildEnter} onFocus={viewport.onChildFocus} />
      <SelectionModeButton engine={viewport.engine} />
    </div>
  );
}

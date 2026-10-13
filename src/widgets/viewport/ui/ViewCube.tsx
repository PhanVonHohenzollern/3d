import { useRef, useSyncExternalStore } from 'react';
import { Home, RotateCcw, RotateCw } from 'lucide-react';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import { kViewCubeSize, projectViewCube } from '@/widgets/viewport/lib/render/viewCube';
import { kClickDragThreshold } from '@/widgets/viewport/config/viewport';

export function ViewCube({ engine }: { engine: ViewportEngine }) {
  const orientation = useSyncExternalStore(engine.subscribeWidgets, engine.cameraOrientation);
  const faces = projectViewCube(orientation);
  const press = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const buttonClass =
    'rounded p-1 text-viewport-button-fg hover:bg-viewport-button-hover focus-visible:outline-2 focus-visible:outline-primary';

  return (
    <div
      className="absolute top-2 right-2 z-3 text-viewport-button-fg"
      style={{ width: kViewCubeSize, height: kViewCubeSize }}
      aria-label="Camera views"
      onPointerEnter={() => engine.eventFilter('Enter')}
      onContextMenu={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        press.current = { x: event.clientX, y: event.clientY };
        dragged.current = false;
      }}
      onPointerMove={(event) => {
        if (!press.current || !(event.buttons & 1)) return;
        if (
          Math.abs(event.clientX - press.current.x) + Math.abs(event.clientY - press.current.y) >=
          kClickDragThreshold
        )
          dragged.current = true;
      }}
      onClickCapture={(event) => {
        // ViewCube changes views on a click only; free rotation stays in the viewport.
        if (dragged.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
        press.current = null;
      }}
    >
      <svg viewBox="0 0 144 124" className="block w-full" aria-label="ViewCube">
        <circle cx="72" cy="64" r="59" className="fill-viewport-button/60 stroke-viewport-button-line" />
        {faces.map((face) => (
          <g key={face.name}>
            {face.patches.map((patch, index) => (
              <polygon
                key={index}
                points={patch.points}
                role="button"
                tabIndex={0}
                aria-label={`${patch.name} view`}
                className="cursor-pointer fill-viewport-button stroke-viewport-button-line hover:fill-primary/40 focus:fill-primary/40 focus:outline-none"
                strokeWidth="0.8"
                onClick={() => engine.setViewDirection(patch.direction)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  engine.setViewDirection(patch.direction);
                }}
              >
                <title>{patch.name}</title>
              </polygon>
            ))}
            <text
              x={face.label.x}
              y={face.label.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none fill-current text-[9px] font-semibold"
            >
              {face.name.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2">
        <button
          type="button"
          className={buttonClass}
          title="Roll left 90°"
          aria-label="Roll left 90°"
          onClick={() => engine.rollView(Math.PI / 2)}
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          className={buttonClass}
          title="Home view and fit"
          aria-label="Home view and fit"
          onClick={() => engine.homeView()}
        >
          <Home size={14} />
        </button>
        <button
          type="button"
          className={buttonClass}
          title="Roll right 90°"
          aria-label="Roll right 90°"
          onClick={() => engine.rollView(-Math.PI / 2)}
        >
          <RotateCw size={14} />
        </button>
      </div>
    </div>
  );
}

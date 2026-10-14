import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import {
  activeNavigationView,
  kViewCubeSize,
  navigationViews,
  projectViewCube,
} from '@/widgets/viewport/lib/render/viewCube';
import { kClickDragThreshold } from '@/widgets/viewport/config/viewport';

function ViewButton({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      className="group cursor-pointer outline-none"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick();
      }}
    >
      <title>{label}</title>
      {children}
    </g>
  );
}

export function ViewCube({ engine }: { engine: ViewportEngine }) {
  const orientation = useSyncExternalStore(engine.subscribeWidgets, engine.cameraOrientation);
  const faces = projectViewCube(orientation);
  const activeView = activeNavigationView(orientation);
  const press = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  return (
    <div
      className="absolute top-2 right-2 z-3"
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
      <svg viewBox="0 0 160 160" className="block size-full" aria-label="ViewCube">
        <circle cx="80" cy="80" r="77" fill="#080909" />
        {navigationViews.map((view) => (
          <ViewButton
            key={view.name}
            label={`${view.name} view`}
            selected={activeView === view.name}
            onClick={() => engine.setViewDirection(view.direction)}
          >
            <path
              d={view.path}
              className={
                activeView === view.name
                  ? 'fill-[#00566f] group-hover:fill-[#0084a5] group-focus-visible:stroke-[#c9f1ff]'
                  : 'fill-[#6d6e70] group-hover:fill-[#929496] group-focus-visible:stroke-[#c9f1ff]'
              }
            />
          </ViewButton>
        ))}
        <ViewButton label="Home view and fit" onClick={() => engine.homeView()}>
          <circle
            cx="80"
            cy="80"
            r="25"
            className="fill-[#080909] group-hover:fill-[#14313b] group-focus-visible:fill-[#14313b]"
          />
          <g className="pointer-events-none" stroke="#777777" strokeWidth="1.2" strokeLinejoin="round">
            {faces.map((face) => (
              <polygon key={face.name} points={face.points} fill={face.color} />
            ))}
          </g>
        </ViewButton>
      </svg>
    </div>
  );
}

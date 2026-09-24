import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingWindow } from '../../hooks/useFloatingWindow';

interface FloatingWindowProps {
  title: string;
  raiseSerial: number;
  onClose: () => void;
  children: ReactNode;
}

export function FloatingWindow({ title, raiseSerial, onClose, children }: FloatingWindowProps) {
  const { windowRef, geometry, onTitlePointerDown, onGripPointerDown, onKeyDown } = useFloatingWindow(
    raiseSerial,
    onClose,
  );

  return createPortal(
    <div
      ref={windowRef}
      data-floating-window
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className="group/window fixed z-100 flex min-h-40 min-w-80 flex-col rounded-t-md rounded-b-qt border border-frame bg-window font-ui text-ui text-fg shadow-[0_10px_30px_rgba(0,0,0,0.3)] outline-none select-none"
      style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
      onKeyDown={onKeyDown}
    >
      <div
        className="flex h-7 flex-none cursor-default touch-none items-center rounded-t-md border-b border-line bg-linear-to-b/srgb from-bar-top to-bar-bottom pr-1 pl-2.5 group-focus-within/window:from-title-active-top group-focus-within/window:to-title-active-bottom"
        onPointerDown={onTitlePointerDown}
      >
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{title}</span>
        <button
          type="button"
          aria-label="Close"
          className="h-[22px] w-6 rounded-qt bg-transparent text-arrow hover:bg-close-hover"
          onClick={onClose}
        >
          {'\u2715'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-[9px]">{children}</div>
      <div
        className="absolute right-0 bottom-0 h-3.5 w-3.5 cursor-nwse-resize touch-none bg-[linear-gradient(135deg,transparent_55%,#9a9a9a_55%,#9a9a9a_62%,transparent_62%,transparent_75%,#9a9a9a_75%,#9a9a9a_82%,transparent_82%)]"
        onPointerDown={onGripPointerDown}
      />
    </div>,
    document.body,
  );
}

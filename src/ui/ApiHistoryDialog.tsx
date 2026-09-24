// Port of the widget part of ui/ApiHistoryDialog: a modeless, movable and
// resizable floating window (not a browser dialog) with a caption, the
// parameter history tree and a Close button. Esc closes it (QDialog::reject).
// The window starts centered, min(1380, width - 60) x min(720, height - 60).

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ApiHistoryDialogModel } from './ApiHistoryModel';
import { useObservable } from './Observable';
import { TreeView } from './TreeView';
import './ApiHistoryDialog.css';

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

function initialGeometry(): Geometry {
  const width = Math.max(Math.min(1380, window.innerWidth - 60), 320);
  const height = Math.max(Math.min(720, window.innerHeight - 60), 200);
  return {
    x: Math.max((window.innerWidth - width) / 2, 0),
    y: Math.max((window.innerHeight - height) / 2, 0),
    width,
    height,
  };
}

function dragWith(event: ReactPointerEvent<HTMLElement>, onMove: (dx: number, dy: number) => void): void {
  if (event.button !== 0) return;
  event.preventDefault();
  const element = event.currentTarget;
  element.setPointerCapture(event.pointerId);
  const startX = event.clientX;
  const startY = event.clientY;
  const move = (e: PointerEvent) => onMove(e.clientX - startX, e.clientY - startY);
  const up = () => {
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', up);
  };
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
}

export function ApiHistoryDialog({ dialog }: { dialog: ApiHistoryDialogModel }) {
  useObservable(dialog);
  const windowRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState(initialGeometry);
  const raiseSerial = dialog.raiseSerial();

  // show(); raise(); activateWindow();
  useLayoutEffect(() => {
    windowRef.current?.focus({ preventScroll: true });
  }, [raiseSerial]);

  if (!dialog.isOpen()) return null;

  const onTitlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as Element).closest('button')) return;
    const start = geometry;
    dragWith(event, (dx, dy) =>
      setGeometry({
        ...start,
        x: Math.min(Math.max(start.x + dx, 40 - start.width), window.innerWidth - 40),
        y: Math.min(Math.max(start.y + dy, 0), window.innerHeight - 24),
      }),
    );
  };
  const onGripPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const start = geometry;
    dragWith(event, (dx, dy) =>
      setGeometry({
        ...start,
        width: Math.max(start.width + dx, 320),
        height: Math.max(start.height + dy, 160),
      }),
    );
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // Keys inside the dialog never reach MainWindow's shortcuts (another window).
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  };

  return createPortal(
    <div
      ref={windowRef}
      className="floating-window api-history-dialog"
      role="dialog"
      aria-label={dialog.windowTitle}
      tabIndex={-1}
      style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
      onKeyDown={onKeyDown}
    >
      <div className="floating-window-titlebar" onPointerDown={onTitlePointerDown}>
        <span className="floating-window-title">{dialog.windowTitle}</span>
        <button type="button" className="floating-window-close" aria-label="Close" onClick={() => dialog.close()}>
          {'\u2715'}
        </button>
      </div>
      <div className="floating-window-body">
        <div className="api-history-caption">{dialog.caption}</div>
        <TreeView tree={dialog.tree} className="api-history-tree" />
        <div className="dialog-button-box">
          <button type="button" className="push-button" onClick={() => dialog.close()}>
            Close
          </button>
        </div>
      </div>
      <div className="floating-window-grip" onPointerDown={onGripPointerDown} />
    </div>,
    document.body,
  );
}

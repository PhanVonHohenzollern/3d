// DOM view of renderer/DebugLabelPanel: the header QLabel over the LabelList
// (QListWidget) painted by LabelDelegate. All state and selection behavior
// live in DebugLabelPanel.ts; this component renders it and forwards input.

import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { DebugLabelPanel } from './DebugLabelPanel';
import { cssColor, qColor } from './OverlayPainter';
import { modifiersFromEvent, mouseButtonFromDom, mouseButtonsFromDom } from './QtEvents';
import { cssFont } from './TextMetrics';

const kSelectedDotColor = cssColor(qColor(255, 230, 115));

export interface DebugLabelPanelViewProps {
  panel: DebugLabelPanel;
  /** The viewport's eventFilter() on this child: Enter / FocusIn clear the 3D hover. */
  onEnterOrFocus: () => void;
}

export function DebugLabelPanelView({ panel, onEnterOrFocus }: DebugLabelPanelViewProps) {
  useSyncExternalStore(panel.subscribe, panel.getVersion);
  const listRef = useRef<HTMLDivElement>(null);
  const geometry = panel.geometry();
  const visible = panel.isVisible();
  const rowHeight = panel.rowHeight();
  const entries = panel.entries();
  const dotTop = Math.trunc((rowHeight - 1) / 2) - 2.5;

  // Apply the model's scroll position (restore after rebuild, scrollToItem).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !visible) return;
    const wanted = panel.scrollValue();
    if (Math.abs(list.scrollTop - wanted) >= 1) list.scrollTop = wanted;
  });

  const viewportPosition = (e: { clientX: number; clientY: number }) => {
    const rect = listRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const { x, y } = viewportPosition(e);
    // Presses on the native scroll bar stay with the browser.
    if (x >= list.clientWidth) return;
    e.preventDefault();
    list.focus({ preventScroll: true });
    try {
      list.setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (synthetic event): no capture.
    }
    panel.mousePressEvent(x, y, mouseButtonFromDom(e.button), modifiersFromEvent(e));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const buttons = mouseButtonsFromDom(e.buttons);
    if (!buttons) return;
    const { x, y } = viewportPosition(e);
    panel.mouseMoveEvent(x, y, buttons, modifiersFromEvent(e));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const { x, y } = viewportPosition(e);
    panel.mouseReleaseEvent(x, y, mouseButtonFromDom(e.button), modifiersFromEvent(e));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (panel.keyPressEvent(e.key, modifiersFromEvent(e))) e.preventDefault();
  };

  // No browser context menu or middle-button autoscroll over the list.
  const suppress = (e: MouseEvent) => e.preventDefault();
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  return (
    <div
      className="debug-label-panel"
      data-panel={panel.title()}
      hidden={!visible}
      style={{
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        font: cssFont(panel.font()),
      }}
      onPointerEnter={onEnterOrFocus}
      onFocus={onEnterOrFocus}
      onContextMenu={suppress}
    >
      <div className="debug-label-panel-header">{panel.headerText()}</div>
      <div
        ref={listRef}
        className="debug-label-panel-list"
        role="listbox"
        aria-label={panel.title()}
        aria-multiselectable
        tabIndex={0}
        onScroll={(e) => panel.setScrollValueFromView(e.currentTarget.scrollTop)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMouseDown={onMouseDown}
        onAuxClick={suppress}
        onKeyDown={onKeyDown}
      >
        <div
          className="debug-label-panel-rows"
          style={{ height: entries.length * rowHeight, width: panel.itemWidth() }}
        >
          {entries.map((entry, row) => {
            const layout = panel.rowLayout(row);
            return (
              <div
                key={entry.id}
                role="option"
                aria-selected={layout.selected}
                className={layout.selected ? 'debug-label-panel-row selected' : 'debug-label-panel-row'}
                style={{ top: row * rowHeight, height: rowHeight, width: layout.width, lineHeight: `${rowHeight}px` }}
              >
                <span
                  className="debug-label-panel-dot"
                  style={{ top: dotTop, background: layout.selected ? kSelectedDotColor : cssColor(panel.color) }}
                />
                <span className="debug-label-panel-name" style={{ left: layout.nameLeft, width: layout.nameWidth }}>
                  {layout.nameText}
                </span>
                <span className="debug-label-panel-value" style={{ left: layout.valueLeft, width: layout.valueWidth }}>
                  {layout.valueText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

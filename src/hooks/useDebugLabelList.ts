import {
  useLayoutEffect,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type UIEvent,
} from 'react';
import type { DebugLabelPanel } from '../core/viewport/DebugLabelPanel';
import { isDomMiddleButton, modifiersFromEvent, mouseButtonFromDom, mouseButtonsFromDom } from '../helpers/qtInput';
import { capturePointer } from '../utils/dom';
import { preventDefault } from '../utils/events';
import { cssColor } from '../utils/painting';
import { cssFont } from '../utils/textMetrics';

type ListPointerEvent = PointerEvent<HTMLDivElement>;

export function useDebugLabelList(panel: DebugLabelPanel, listRef: RefObject<HTMLDivElement | null>) {
  const snapshot = useSyncExternalStore(panel.subscribe, panel.getSnapshot);
  const { geometry, rowHeight, visible, scrollValue } = snapshot;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !visible) return;
    if (Math.abs(list.scrollTop - scrollValue) >= 1) list.scrollTop = scrollValue;
  });

  const listPosition = (e: { clientX: number; clientY: number }) => {
    const rect = listRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ListPointerEvent) => {
    const list = listRef.current;
    if (!list) return;
    const { x, y } = listPosition(e);
    const onNativeScrollBar = x >= list.clientWidth;
    if (onNativeScrollBar) return;
    e.preventDefault();
    list.focus({ preventScroll: true });
    capturePointer(list, e.pointerId);
    panel.mousePressEvent(x, y, mouseButtonFromDom(e.button), modifiersFromEvent(e));
  };

  const onPointerMove = (e: ListPointerEvent) => {
    const buttons = mouseButtonsFromDom(e.buttons);
    if (!buttons) return;
    const { x, y } = listPosition(e);
    panel.mouseMoveEvent(x, y, buttons, modifiersFromEvent(e));
  };

  const onPointerUp = (e: ListPointerEvent) => {
    const { x, y } = listPosition(e);
    panel.mouseReleaseEvent(x, y, mouseButtonFromDom(e.button), modifiersFromEvent(e));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (panel.keyPressEvent(e.key, modifiersFromEvent(e))) e.preventDefault();
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => panel.setScrollValueFromView(e.currentTarget.scrollTop);

  const onMouseDown = (e: MouseEvent) => {
    if (isDomMiddleButton(e.button)) e.preventDefault();
  };

  const dotTop = Math.trunc((rowHeight - 1) / 2) - 2.5;
  const panelColor = cssColor(snapshot.color);

  return {
    title: snapshot.title,
    headerText: snapshot.headerText,
    visible,
    panelStyle: {
      left: geometry.x,
      top: geometry.y,
      width: geometry.width,
      height: geometry.height,
      font: cssFont(snapshot.font),
    },
    onContextMenu: preventDefault,
    listHandlers: {
      onScroll,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onMouseDown,
      onAuxClick: preventDefault,
      onKeyDown,
    },
    rowsStyle: { height: snapshot.rows.length * rowHeight, width: snapshot.itemWidth },
    rows: snapshot.rows.map((row, index) => ({
      id: row.id,
      selected: row.selected,
      style: { top: index * rowHeight, height: rowHeight, width: row.width, lineHeight: `${rowHeight}px` },
      dotStyle: { top: dotTop, backgroundColor: row.selected ? undefined : panelColor },
      nameText: row.nameText,
      nameStyle: { left: row.nameLeft, width: row.nameWidth },
      valueText: row.valueText,
      valueStyle: { left: row.valueLeft, width: row.valueWidth },
    })),
  };
}

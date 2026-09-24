import { useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { eventModifiers } from '../helpers/keyboard';
import { isInTableHeader, tableRowOf } from '../helpers/tableEvents';
import type { VariablePanelProps } from '../types/panels';
import { useObservable } from './useObservable';
import { VariablePanelModel } from './variablePanel/VariablePanelModel';

export function useVariablePanel({ onSelectionChanged, ref }: VariablePanelProps) {
  const [model] = useState(() => new VariablePanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    model.setSelectionChangedCallback(onSelectionChanged ?? null);
  }, [model, onSelectionChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const scrollRequest = model.scrollRequest;
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || !scrollRequest) return;

    const scrollToSelection = () => {
      const row = table.querySelector<HTMLElement>(`tr[data-row="${scrollRequest.row}"]`);
      if (!row || !table.clientHeight) return;
      const top = row.getBoundingClientRect().top - table.getBoundingClientRect().top + table.scrollTop;
      const bottom = top + row.offsetHeight;
      // Scroll this inspector only, keeping the selected row below its sticky header.
      if (scrollRequest.center) table.scrollTop = top - (table.clientHeight - row.offsetHeight) / 2;
      else if (top < table.scrollTop + 28) table.scrollTop = top - 28;
      else if (bottom > table.scrollTop + table.clientHeight) table.scrollTop = bottom - table.clientHeight;
    };

    scrollToSelection();
    const observer = new ResizeObserver(scrollToSelection);
    observer.observe(table);

    return () => observer.disconnect();
  }, [scrollRequest]);

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || isInTableHeader(event)) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    model.mousePress(tableRowOf(event), eventModifiers(event).control);
  };

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || isInTableHeader(event)) return;
    model.mouseRelease(tableRowOf(event));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (model.keyPress(event.key)) event.preventDefault();
  };

  return {
    tableRef,
    summary: model.summary,
    rows: model.rows.map((row, index) => ({ ...row, index, selected: index === model.selectedRow })),
    onMouseDown,
    onMouseUp,
    onKeyDown,
  };
}

import { useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { eventModifiers } from '@/helpers/keyboard';
import { isInTableHeader, tableRowOf } from '@/helpers/tableEvents';
import type { ScrollRequest, VariablePanelProps } from '@/types/panels';
import { isOnScrollbar } from '@/utils/dom';
import { useObservable } from '@/hooks/useObservable';
import { useScrollSelectionIntoView } from '@/hooks/useScrollSelectionIntoView';
import { VariablePanelModel } from '@/hooks/variablePanel/VariablePanelModel';

// Scroll this inspector only, keeping the selected row below its sticky header.
function scrollToSelectedVariable(table: HTMLElement, request: ScrollRequest): void {
  const row = table.querySelector<HTMLElement>(`tr[data-row="${request.row}"]`);
  if (!row || !table.clientHeight) return;
  const top = row.getBoundingClientRect().top - table.getBoundingClientRect().top + table.scrollTop;
  const bottom = top + row.offsetHeight;
  if (request.center) table.scrollTop = top - (table.clientHeight - row.offsetHeight) / 2;
  else if (top < table.scrollTop + 28) table.scrollTop = top - 28;
  else if (bottom > table.scrollTop + table.clientHeight) table.scrollTop = bottom - table.clientHeight;
}

export function useVariablePanel({ onSelectionChanged, ref }: VariablePanelProps) {
  const [model] = useState(() => new VariablePanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    model.setSelectionChangedCallback(onSelectionChanged ?? null);
  }, [model, onSelectionChanged]);
  useImperativeHandle(ref, () => model, [model]);

  useScrollSelectionIntoView(tableRef, model.scrollRequest, scrollToSelectedVariable);

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || isInTableHeader(event) || isOnScrollbar(event)) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    model.mousePress(tableRowOf(event), eventModifiers(event).control);
  };

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0 || isInTableHeader(event) || isOnScrollbar(event)) return;
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

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

  const scrollSerial = model.scrollRequest?.serial;
  useLayoutEffect(() => {
    const request = model.scrollRequest;
    if (!request) return;
    tableRef.current
      ?.querySelector<HTMLElement>(`tr[data-row="${request.row}"]`)
      ?.scrollIntoView({ block: request.center ? 'center' : 'nearest' });
  }, [model, scrollSerial]);

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
    rows: model.rows.map((row, index) => ({ ...row, selected: index === model.selectedRow })),
    onMouseDown,
    onMouseUp,
    onKeyDown,
  };
}

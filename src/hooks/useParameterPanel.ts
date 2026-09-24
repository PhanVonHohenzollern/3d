import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { eventModifiers } from '../helpers/keyboard';
import { isInElement, isInTableHeader, tableCellOf } from '../helpers/tableEvents';
import type { ParameterPanelProps } from '../types/panels';
import { kParameterHeaders, kParameterValueColumn, ParameterPanelModel } from './parameterPanel/ParameterPanelModel';
import { useObservable } from './useObservable';

export function useParameterPanel({ onChanged, ref }: ParameterPanelProps) {
  const [model] = useState(() => new ParameterPanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    model.setChangedCallback(onChanged ?? null);
  }, [model, onChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const editorSerial = model.editor?.serial;
  useLayoutEffect(() => {
    if (editorSerial === undefined) return;
    editorRef.current?.focus();
    editorRef.current?.select();
  }, [editorSerial]);

  const focusTable = () => tableRef.current?.focus({ preventScroll: true });
  const ignored = (event: MouseEvent) => event.button !== 0 || isInElement(event, 'input') || isInTableHeader(event);

  const onMouseDown = (event: MouseEvent) => {
    if (ignored(event)) return;
    event.preventDefault();
    const { row, column } = tableCellOf(event);
    if (event.detail === 2) {
      model.mouseDoubleClick(row, column);
      return;
    }
    const closedEditor = model.editor !== null;
    focusTable();
    model.mousePress(row, column, eventModifiers(event).control, closedEditor);
  };
  const onMouseUp = (event: MouseEvent) => {
    if (ignored(event)) return;
    const { row, column } = tableCellOf(event);
    model.mouseRelease(row, column);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== tableRef.current || event.altKey || event.ctrlKey || event.metaKey) return;
    if (model.keyPress(event.key, event.shiftKey)) event.preventDefault();
  };
  const onEditorChange = (event: ChangeEvent<HTMLInputElement>) => model.editorTextEdited(event.target.value);
  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      model.commitEditor();
      focusTable();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      model.revertEditor();
      focusTable();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      model.commitEditorAndMove(event.shiftKey);
      if (!model.editor) focusTable();
    }
  };
  const onEditorBlur = (event: FocusEvent<HTMLInputElement>) =>
    model.commitEditor(Number(event.currentTarget.dataset.serial));

  return {
    tableRef,
    editorRef,
    headers: kParameterHeaders,
    valueColumn: kParameterValueColumn,
    rows: model.rows,
    selectedRow: model.selectedRow,
    currentRow: model.currentRow,
    currentColumn: model.currentColumn,
    editor: model.editor,
    onMouseDown,
    onMouseUp,
    onKeyDown,
    onEditorChange,
    onEditorKeyDown,
    onEditorBlur,
  };
}

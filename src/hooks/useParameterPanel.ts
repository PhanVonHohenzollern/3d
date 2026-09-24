import { useImperativeHandle, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { ParameterPanelProps } from '../types/panels';
import { kParameterValueColumn, ParameterPanelModel } from './parameterPanel/ParameterPanelModel';
import { useObservable } from './useObservable';
import { parameterTableCells, parameterTableText } from '../helpers/parameterTable';
import { parameterGridLayout } from '../helpers/parameters';

interface TableDraft {
  text: string;
  cells: string[][];
  error: string;
}

function tableDraftFromText(text: string): TableDraft {
  try {
    return { text, cells: parameterTableCells(text), error: '' };
  } catch (error) {
    return { text, cells: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export function useParameterPanel({ onChanged, ref }: ParameterPanelProps) {
  const [model] = useState(() => new ParameterPanelModel());
  const [draft, setDraft] = useState<TableDraft | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  useObservable(model);

  useLayoutEffect(() => {
    const element = gridRef.current;
    if (!element) return;

    const measure = () => {
      if (!element.clientWidth) return;
      setGridSize({ width: element.clientWidth - 8, height: element.clientHeight - 8 });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    model.setChangedCallback(onChanged ?? null);
  }, [model, onChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const fields = model.rows.map((row, index) => {
    const value = model.editor?.row === index ? model.editor.text : row.texts[kParameterValueColumn];

    const beginEdit = () => {
      if (model.editor?.row !== index) model.edit(index, kParameterValueColumn);
    };

    const commit = () => {
      if (model.editor?.row === index) model.commitEditor();
    };

    const change = (text: string) => {
      beginEdit();
      model.editorTextEdited(text);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        model.revertEditor();
        event.currentTarget.blur();
      }
    };

    return {
      key: `${row.key}:${row.line}:${row.texts[2]}`,
      label: row.texts[0],
      value,
      checkbox: !!row.checkbox,
      disabled: !!row.disabled,
      setChecked: (checked: boolean) => model.setExtInsulationEnabled(checked),
      options: model.dataSets.flatMap((data, rowIndex) => {
        const option = data.get(row.key);

        return option === undefined ? [] : [{ row: rowIndex, value: option }];
      }),
      selectedDataSet: model.dataSetIndex,
      selectDataSet: (dataSet: number) => model.selectDataSet(dataSet),
      beginEdit,
      change,
      commit,
      onKeyDown,
    };
  });
  const grid = parameterGridLayout(fields.length, gridSize.width, gridSize.height);
  const groups = Array.from({ length: grid.columns }, (_, column) =>
    fields.slice(column * grid.rows, (column + 1) * grid.rows),
  );

  const onPaste = (event: ClipboardEvent) => {
    const text = event.clipboardData.getData('text/plain');
    // A single Excel cell may include a final newline; preserve ordinary input paste.
    if (!/[\t\r\n]/.test(text.replace(/[\r\n]+$/, ''))) return;
    event.preventDefault();
    setDraft(tableDraftFromText(text));
  };

  let draftError = draft?.error ?? '';
  let draftSummary = '';
  if (draft?.cells.length && !draftError) {
    try {
      const preview = model.previewTable(parameterTableText(draft.cells));
      draftSummary =
        `${preview.data.length} data row(s) · ${preview.columns} parameter(s)` +
        (preview.ignored.length ? ` · Ignored columns: ${preview.ignored.join(', ')}` : '');
    } catch (error) {
      draftError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    fields,
    gridRef,
    groups,
    onPaste,
    pasteMessage: model.pasteMessage,
    pasteIsError: model.pasteIsError,
    dataSetIndex: model.dataSetIndex,
    dataSetCount: model.dataSets.length,
    selectDataSet: (index: number) => model.selectDataSet(index),
    openTable: () => setDraft((current) => current ?? tableDraftFromText('')),
    tableDialog: draft && {
      text: draft.text,
      cells: draft.cells,
      columnCount: Math.max(0, ...draft.cells.map((row) => row.length)),
      parameterNames: [...new Set(model.rows.filter((row) => !row.checkbox).map((row) => row.key))],
      error: draftError,
      summary: draftSummary,
      canApply: !!draftSummary && !draftError,
      close: () => setDraft(null),
      setText: (text: string) => setDraft(tableDraftFromText(text)),
      editCell: (row: number, column: number, value: string) =>
        setDraft((current) => {
          if (!current) return current;
          const cells = current.cells.map((items) => [...items]);
          while (cells[row].length <= column) cells[row].push('');
          cells[row][column] = value;

          return { text: parameterTableText(cells), cells, error: '' };
        }),
      apply: () => {
        if (!draftError && draftSummary && model.importTable(parameterTableText(draft.cells))) setDraft(null);
      },
    },
    resetToSource: () => model.resetToSource(),
  };
}

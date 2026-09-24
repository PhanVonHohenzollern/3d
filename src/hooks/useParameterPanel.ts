import { useImperativeHandle, useLayoutEffect, useState, type KeyboardEvent } from 'react';
import type { ParameterPanelProps } from '../types/panels';
import { kParameterValueColumn, ParameterPanelModel } from './parameterPanel/ParameterPanelModel';
import { useObservable } from './useObservable';

export function useParameterPanel({ onChanged, ref }: ParameterPanelProps) {
  const [model] = useState(() => new ParameterPanelModel());
  useObservable(model);

  useLayoutEffect(() => {
    model.setChangedCallback(onChanged ?? null);
  }, [model, onChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const fields = model.rows.map((row, index) => {
    const value = model.editor?.row === index ? model.editor.text : row.texts[kParameterValueColumn];
    const numeric = /^(double|float|int|long|short|unsigned|size_t)/.test(row.texts[1]);

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

    const step = (amount: number) => {
      const number = Number(value);
      if (!value.trim() || !Number.isFinite(number)) return;
      change(String(number + amount));
      commit();
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
      line: `L${row.line}`,
      description: `${row.texts[1]} ${row.texts[2]}`,
      value,
      numeric,
      stepDisabled: !value.trim() || !Number.isFinite(Number(value)),
      beginEdit,
      change,
      commit,
      onKeyDown,
      decrement: () => step(-1),
      increment: () => step(1),
    };
  });

  return { fields, resetToSource: () => model.resetToSource() };
}

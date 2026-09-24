import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  kAngleLabels,
  kAxisLabels,
  kConnectorTypes,
  kLinkTableHeaders,
  kOrientationLabels,
  kSizePlaceholder,
} from '../helpers/link';
import { isInElement, isInTableHeader, tableCellOf } from '../helpers/tableEvents';
import type { LinkPanelProps, SizeField } from '../types/panels';
import { LinkPanelModel } from './linkPanel/LinkPanelModel';
import { useObservable } from './useObservable';

export function useLinkPanel({ expressionEvaluator, onPreviewChanged, ref }: LinkPanelProps) {
  const [model] = useState(() => new LinkPanelModel());
  useObservable(model);
  const tableRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    model.setExpressionEvaluator(expressionEvaluator ?? null);
    model.setPreviewChangedCallback(onPreviewChanged ?? null);
  }, [model, expressionEvaluator, onPreviewChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const focusNameSerial = model.focusNameSerial;
  useLayoutEffect(() => {
    if (!focusNameSerial) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [focusNameSerial]);

  const scrollSerial = model.scrollRequest?.serial;
  useLayoutEffect(() => {
    const request = model.scrollRequest;
    if (!request) return;
    tableRef.current?.querySelector(`tr[data-row="${request.row}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [model, scrollSerial]);

  const onTableMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || isInTableHeader(event) || isInElement(event, 'button')) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    const { row, column } = tableCellOf(event);
    if (row >= 0) model.cellActivated(row, column);
  };
  const onTableKeyDown = (event: KeyboardEvent) => {
    if (event.target !== tableRef.current || event.altKey || event.ctrlKey || event.metaKey) return;
    if (model.tableKeyPress(event.key)) event.preventDefault();
  };

  return {
    tableRef,
    nameRef,
    table: {
      headers: kLinkTableHeaders,
      rows: model.tableRows,
      currentRow: model.currentRow,
      currentColumn: model.currentColumn,
      onMouseDown: onTableMouseDown,
      onKeyDown: onTableKeyDown,
      togglePreview: (id: number) => () => model.togglePreview(id),
    },
    form: {
      typeOptions: kConnectorTypes,
      sizePlaceholder: kSizePlaceholder,
      orientationLabels: kOrientationLabels,
      axisLabels: kAxisLabels,
      angleLabels: kAngleLabels,
      disabled: !model.formEnabled,
      name: model.nameText,
      point: model.pointText,
      typeIndex: model.typeIndex,
      sizeTexts: model.sizeTexts,
      parameterNames: model.parameterNames,
      orientationId: model.orientationId,
      positions: model.positionTexts,
      angles: model.angleTexts,
      circular: model.circularFields,
      status: model.statusText,
      statusIsError: model.statusIsError,
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => model.nameEdited(event.target.value),
      onPointChange: (event: ChangeEvent<HTMLInputElement>) => model.pointEdited(event.target.value),
      onPointBlur: () => model.pointEditingFinished(false),
      onPointKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter') model.pointEditingFinished(true);
      },
      onTypeChange: (event: ChangeEvent<HTMLSelectElement>) => model.typeChanged(Number(event.target.value)),
      sizeTextChanged: (field: SizeField) => (text: string) => model.sizeTextChanged(field, text),
      orientationClicked: (id: number) => () => model.orientationClicked(id),
      positionChanged: (index: number) => (event: ChangeEvent<HTMLInputElement>) =>
        model.positionEdited(index, event.target.value),
      angleChanged: (index: number) => (event: ChangeEvent<HTMLInputElement>) =>
        model.angleEdited(index, event.target.value),
      test: () => model.testSelection(),
    },
    addConnector: () => model.addConnector(),
    removeConnector: () => model.removeConnector(),
  };
}

import { useContainerPagination } from './useContainerPagination';
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
  const [isEditing, setIsEditing] = useState(false);

  useLayoutEffect(() => {
    model.setExpressionEvaluator(expressionEvaluator ?? null);
    model.setPreviewChangedCallback(onPreviewChanged ?? null);
  }, [model, expressionEvaluator, onPreviewChanged]);
  useImperativeHandle(ref, () => model, [model]);

  const focusNameSerial = model.focusNameSerial;
  useLayoutEffect(() => {
    if (!isEditing) return;
    nameRef.current?.focus({ preventScroll: true });
    nameRef.current?.select();
  }, [focusNameSerial, isEditing]);

  const pagination = useContainerPagination(
    model.tableRows.map((row, index) => ({ ...row, index })),
    {
      rowHeight: 28,
      headerHeight: 28,
      selectedIndex: model.currentRow,
      selectionKey: `${model.currentRow}:${model.scrollRequest?.serial}`,
    },
  );

  const showList = () => setIsEditing(false);

  const editSelected = () => setIsEditing(true);

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
    showList,
    editSelected,
    isEditing,
    hasConnectors: model.tableRows.length > 0,
    canEdit: model.formEnabled,
    selectedName: model.nameText,
    nameRef,
    table: {
      headers: kLinkTableHeaders,
      rows: pagination.items,
      pagination,
      currentRow: model.currentRow,
      currentColumn: model.currentColumn,
      onMouseDown: onTableMouseDown,
      onKeyDown: onTableKeyDown,
      togglePreview: (id: number) => () => model.togglePreview(id),
    },
    form: {
      feedback: model.statusText || 'Set the connector details, then Make to preview.',
      typeOptions: kConnectorTypes,
      sizePlaceholder: kSizePlaceholder,
      orientations: kOrientationLabels.map((label, id) => ({
        label,
        selected: model.orientationId === id,
        onClick: () => model.orientationClicked(id),
      })),
      positionFields: kAxisLabels.map((label, index) => ({
        label,
        value: model.positionTexts[index],
        onChange: (event: ChangeEvent<HTMLInputElement>) => model.positionEdited(index, event.target.value),
      })),
      angleFields: kAngleLabels.map((label, index) => ({
        label,
        value: model.angleTexts[index],
        onChange: (event: ChangeEvent<HTMLInputElement>) => model.angleEdited(index, event.target.value),
      })),
      disabled: !model.formEnabled,
      name: model.nameText,
      point: model.pointText,
      typeIndex: model.typeIndex,
      sizeTexts: model.sizeTexts,
      parameterNames: model.parameterNames,
      circular: model.circularFields,
      statusIsError: model.statusIsError,
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => model.nameEdited(event.target.value),
      onPointChange: (event: ChangeEvent<HTMLInputElement>) => model.pointEdited(event.target.value),
      onPointBlur: () => model.pointEditingFinished(false),
      onPointKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter') model.pointEditingFinished(true);
      },
      onTypeChange: (event: ChangeEvent<HTMLSelectElement>) => model.typeChanged(Number(event.target.value)),
      sizeTextChanged: (field: SizeField) => (text: string) => model.sizeTextChanged(field, text),
      test: () => model.testSelection(),
    },
    addConnector: () => {
      setIsEditing(true);
      model.addConnector();
    },
    removeConnector: () => {
      model.removeConnector();
      showList();
    },
  };
}

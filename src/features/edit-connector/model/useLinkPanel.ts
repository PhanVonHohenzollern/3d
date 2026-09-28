import { useContainerPagination } from '@/shared/ui/pagination';
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
} from '@/entities/connector';
import { isInElement, isInTableHeader, tableCellOf } from '@/shared/ui/table-view';
import type { SizeField } from '@/entities/connector';
import type { LinkFormProps } from '@/features/edit-connector/ui/types';
import type { LinkPanelProps } from '@/features/edit-connector/model/types';
import { LinkPanelModel } from '@/features/edit-connector/model/LinkPanelModel';
import { useObservable } from '@/shared/lib/observable';

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

  const onTableMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || isInTableHeader(event) || isInElement(event, 'button')) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    const { row, column } = tableCellOf(event);
    if (row >= 0) model.cellActivated(row, column);
  };

  const onTableKeyDown = (event: KeyboardEvent) => {
    if (event.target !== tableRef.current || event.altKey || event.ctrlKey || event.metaKey) return;
    if ((event.key === 'Enter' || event.key === 'F2') && model.formEnabled) {
      event.preventDefault();
      setIsEditing(true);

      return;
    }
    if (model.tableKeyPress(event.key)) event.preventDefault();
  };

  return {
    tableRef,
    showList,
    isEditing,
    hasConnectors: model.tableRows.length > 0,
    canEdit: model.formEnabled,
    selectedName: model.nameText,
    table: {
      headers: kLinkTableHeaders,
      rows: pagination.items,
      pagination,
      currentRow: model.currentRow,
      currentColumn: model.currentColumn,
      onMouseDown: onTableMouseDown,
      onDoubleClick: (event: MouseEvent) => {
        if (isInElement(event, 'button') || isInTableHeader(event)) return;
        const { row, column } = tableCellOf(event);
        if (row < 0) return;
        model.cellActivated(row, column);
        setIsEditing(true);
      },
      onKeyDown: onTableKeyDown,
      togglePreview: (id: number) => () => model.togglePreview(id),
    },
    form: {
      disabled: !model.formEnabled,
      nameRef,
      identity: {
        name: model.nameText,
        point: model.pointText,
        nameError: model.fieldErrors.name,
        onNameChange: (event: ChangeEvent<HTMLInputElement>) => model.nameEdited(event.target.value),
        onPointChange: (event: ChangeEvent<HTMLInputElement>) => model.pointEdited(event.target.value),
        onPointBlur: () => model.pointEditingFinished(false),
        onPointKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter') model.pointEditingFinished(true);
        },
      },
      size: {
        typeOptions: kConnectorTypes,
        typeIndex: model.typeIndex,
        circular: model.circularFields,
        texts: model.sizeTexts,
        parameterNames: model.parameterNames,
        placeholder: kSizePlaceholder,
        errors: model.fieldErrors,
        onTypeChange: (event: ChangeEvent<HTMLSelectElement>) => model.typeChanged(Number(event.target.value)),
        onTextChanged: (field: SizeField) => (text: string) => model.sizeTextChanged(field, text),
      },
      position: kAxisLabels.map((label, index) => ({
        label,
        value: model.positionTexts[index],
        onChange: (event: ChangeEvent<HTMLInputElement>) => model.positionEdited(index, event.target.value),
      })),
      rotation: {
        orientations: kOrientationLabels.map((label, id) => ({
          label,
          selected: model.orientationId === id,
          onClick: () => model.orientationClicked(id),
        })),
        angles: kAngleLabels.map((label, index) => ({
          label,
          value: model.angleTexts[index],
          onChange: (event: ChangeEvent<HTMLInputElement>) => model.angleEdited(index, event.target.value),
        })),
      },
      status: {
        feedback: model.statusText || 'Set the connector details, then Make to preview.',
        isError: model.statusIsError,
        test: () => model.testSelection(),
      },
    } satisfies LinkFormProps,
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

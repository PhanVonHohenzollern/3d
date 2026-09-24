import { connectorSteps } from '../helpers/connectorSteps';
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
  const formRef = useRef<HTMLDivElement>(null);

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

  const pagination = useContainerPagination(
    model.tableRows.map((row, index) => ({ ...row, index })),
    {
      rowHeight: 28,
      headerHeight: 28,
      selectedIndex: model.currentRow,
      selectionKey: `${model.currentRow}:${model.scrollRequest?.serial}`,
    },
  );
  const [section, setSection] = useState<string>('Connectors');
  useLayoutEffect(() => {
    formRef.current
      ?.querySelector(`[data-section="${section}"]`)
      ?.querySelector<HTMLElement>('input, select')
      ?.focus({ preventScroll: true });
  }, [section]);

  const stepIndex = connectorSteps.findIndex((step) => step.section === section);
  const step = connectorSteps[stepIndex];
  const canContinue =
    section === 'Identity'
      ? Boolean(model.nameText.trim() && model.pointText.trim())
      : section === 'Dimensions'
        ? Boolean(
            model.circularFields
              ? model.sizeTexts.diameter.trim()
              : model.sizeTexts.aSize.trim() && model.sizeTexts.bSize.trim(),
          )
        : true;

  const showList = () => setSection('Connectors');

  const editSelected = () => setSection('Identity');

  const nextStep = () => setSection(connectorSteps[Math.min(stepIndex + 1, connectorSteps.length - 1)].section);

  const previousStep = () => (stepIndex > 0 ? setSection(connectorSteps[stepIndex - 1].section) : showList());

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
    section,
    showList,
    editSelected,
    isEditing: section !== 'Connectors',
    hasConnectors: model.tableRows.length > 0,
    canEdit: model.formEnabled,
    selectedName: model.nameText,
    steps: connectorSteps.map((step, index) => ({
      ...step,
      number: index + 1,
      active: section === step.section,
      select: () => setSection(step.section),
    })),
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
      formRef,
      previousStep,
      canContinue,
      feedback: model.statusIsError ? model.statusText : model.statusText ? 'Preview ready' : (step?.hint ?? ''),
      nextStep,
      lastStep: stepIndex === connectorSteps.length - 1,
      nextLabel: `Next: ${connectorSteps[stepIndex + 1]?.label ?? 'Preview'}`,
      guidance: step?.hint ?? '',

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
      test: () => model.testSelection(),
    },
    addConnector: () => {
      setSection('Identity');
      model.addConnector();
    },
    removeConnector: () => {
      model.removeConnector();
      showList();
    },
  };
}

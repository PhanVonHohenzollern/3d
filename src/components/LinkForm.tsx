import { useId } from 'react';
import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import type { ConnectorType } from '../core/geometry/ConnectorPreview';
import type { SizeField } from '../types/panels';
import { cn } from '../utils/cn';
import { ComboBox } from './ui/ComboBox';
import { EditableComboBox } from './ui/EditableComboBox';
import { FormLabel } from './ui/FormLabel';
import { LineEdit } from './ui/LineEdit';
import { PushButton } from './ui/PushButton';

interface LinkFormProps {
  nameRef: Ref<HTMLInputElement>;
  typeOptions: readonly ConnectorType[];
  sizePlaceholder: string;
  orientationLabels: readonly string[];
  axisLabels: readonly string[];
  angleLabels: readonly string[];
  disabled: boolean;
  name: string;
  point: string;
  typeIndex: number;
  sizeTexts: Record<SizeField, string>;
  parameterNames: readonly string[];
  orientationId: number;
  positions: readonly string[];
  angles: readonly string[];
  circular: boolean;
  status: string;
  statusIsError: boolean;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPointChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPointBlur: () => void;
  onPointKeyDown: (event: KeyboardEvent) => void;
  onTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  sizeTextChanged: (field: SizeField) => (text: string) => void;
  orientationClicked: (id: number) => () => void;
  positionChanged: (index: number) => (event: ChangeEvent<HTMLInputElement>) => void;
  angleChanged: (index: number) => (event: ChangeEvent<HTMLInputElement>) => void;
  test: () => void;
}

export function LinkForm({ nameRef, ...props }: LinkFormProps) {
  const id = useId();

  return (
    <div className="@container h-full w-full overflow-auto bg-base">
      <fieldset
        disabled={props.disabled}
        className="group/form grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 p-4 @min-[480px]:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <FormLabel htmlFor={`${id}-name`}>Identifier</FormLabel>
        <LineEdit id={`${id}-name`} ref={nameRef} value={props.name} onChange={props.onNameChange} />
        <FormLabel htmlFor={`${id}-point`}>Point</FormLabel>
        <LineEdit
          id={`${id}-point`}
          value={props.point}
          onChange={props.onPointChange}
          onBlur={props.onPointBlur}
          onKeyDown={props.onPointKeyDown}
        />

        <FormLabel htmlFor={`${id}-type`}>Type</FormLabel>
        <ComboBox
          id={`${id}-type`}
          className="col-span-1 @min-[480px]:col-span-3"
          value={props.typeIndex}
          onChange={props.onTypeChange}
        >
          {props.typeOptions.map((type, index) => (
            <option key={type} value={index}>
              {type}
            </option>
          ))}
        </ComboBox>

        {props.circular ? (
          <>
            <FormLabel>Diameter</FormLabel>
            <div className="col-span-1 @min-[480px]:col-span-3">
              <EditableComboBox
                label="Diameter"
                value={props.sizeTexts.diameter}
                items={props.parameterNames}
                disabled={props.disabled}
                placeholder={props.sizePlaceholder}
                onTextChanged={props.sizeTextChanged('diameter')}
              />
            </div>
          </>
        ) : (
          <>
            <FormLabel>A</FormLabel>
            <EditableComboBox
              label="A dimension"
              value={props.sizeTexts.aSize}
              items={props.parameterNames}
              disabled={props.disabled}
              placeholder={props.sizePlaceholder}
              onTextChanged={props.sizeTextChanged('aSize')}
            />
            <FormLabel>B</FormLabel>
            <EditableComboBox
              label="B dimension"
              value={props.sizeTexts.bSize}
              items={props.parameterNames}
              disabled={props.disabled}
              placeholder={props.sizePlaceholder}
              onTextChanged={props.sizeTextChanged('bSize')}
            />
          </>
        )}

        <FormLabel>Orientation</FormLabel>
        <div className="col-span-1 flex flex-wrap gap-[3px] @min-[480px]:col-span-3">
          {props.orientationLabels.map((label, id) => (
            <PushButton
              key={label}
              checked={props.orientationId === id}
              aria-pressed={props.orientationId === id}
              sizeClassName="h-7 min-w-[30px] px-2 text-[11px]"
              onClick={props.orientationClicked(id)}
            >
              {label}
            </PushButton>
          ))}
        </div>

        {props.axisLabels.map((axis, i) => (
          <div key={axis} className="contents">
            <FormLabel htmlFor={`${id}-position-${i}`}>{axis}</FormLabel>
            <LineEdit id={`${id}-position-${i}`} value={props.positions[i]} onChange={props.positionChanged(i)} />
            <FormLabel htmlFor={`${id}-angle-${i}`}>{props.angleLabels[i]}</FormLabel>
            <LineEdit id={`${id}-angle-${i}`} value={props.angles[i]} onChange={props.angleChanged(i)} />
          </div>
        ))}

        <div className="col-span-full">
          <PushButton variant="primary" sizeClassName="h-8 w-[120px] px-3" onClick={props.test}>
            Make
          </PushButton>
        </div>
        <div
          className={cn(
            'col-span-full wrap-anywhere whitespace-pre-wrap select-text group-disabled/form:text-disabled',
            props.statusIsError && 'text-error',
          )}
        >
          {props.status}
        </div>
      </fieldset>
    </div>
  );
}

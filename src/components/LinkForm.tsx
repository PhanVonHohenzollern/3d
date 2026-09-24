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
  return (
    <div className="h-full w-full overflow-auto border border-line bg-window">
      <fieldset
        disabled={props.disabled}
        className="group/form grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 p-[9px]"
      >
        <FormLabel>Identifier</FormLabel>
        <LineEdit ref={nameRef} value={props.name} onChange={props.onNameChange} />
        <FormLabel>Point</FormLabel>
        <LineEdit
          value={props.point}
          onChange={props.onPointChange}
          onBlur={props.onPointBlur}
          onKeyDown={props.onPointKeyDown}
        />

        <FormLabel>Type</FormLabel>
        <ComboBox className="col-span-3" value={props.typeIndex} onChange={props.onTypeChange}>
          {props.typeOptions.map((type, index) => (
            <option key={type} value={index}>
              {type}
            </option>
          ))}
        </ComboBox>

        {props.circular ? (
          <>
            <FormLabel>Diameter</FormLabel>
            <div className="col-span-3">
              <EditableComboBox
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
              value={props.sizeTexts.aSize}
              items={props.parameterNames}
              disabled={props.disabled}
              placeholder={props.sizePlaceholder}
              onTextChanged={props.sizeTextChanged('aSize')}
            />
            <FormLabel>B</FormLabel>
            <EditableComboBox
              value={props.sizeTexts.bSize}
              items={props.parameterNames}
              disabled={props.disabled}
              placeholder={props.sizePlaceholder}
              onTextChanged={props.sizeTextChanged('bSize')}
            />
          </>
        )}

        <FormLabel>Orientation</FormLabel>
        <div className="col-span-3 flex gap-[3px]">
          {props.orientationLabels.map((label, id) => (
            <PushButton
              key={label}
              checked={props.orientationId === id}
              aria-pressed={props.orientationId === id}
              sizeClassName="min-h-6 min-w-[30px] px-3 py-0.5"
              onClick={props.orientationClicked(id)}
            >
              {label}
            </PushButton>
          ))}
        </div>

        {props.axisLabels.map((axis, i) => (
          <div key={axis} className="contents">
            <FormLabel>{axis}</FormLabel>
            <LineEdit value={props.positions[i]} onChange={props.positionChanged(i)} />
            <FormLabel>{props.angleLabels[i]}</FormLabel>
            <LineEdit value={props.angles[i]} onChange={props.angleChanged(i)} />
          </div>
        ))}

        <div className="col-span-full">
          <PushButton sizeClassName="h-[26px] min-h-6 w-[150px] px-3 py-0.5" onClick={props.test}>
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

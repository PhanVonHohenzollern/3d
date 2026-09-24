import { useId } from 'react';
import type { LinkFormProps } from '../types/linkForm';
import { cn } from '../utils/cn';
import { ComboBox } from './ui/ComboBox';
import { EditableComboBox } from './ui/EditableComboBox';
import { FormLabel } from './ui/FormLabel';
import { LineEdit } from './ui/LineEdit';
import { PushButton } from './ui/PushButton';

export function LinkForm({ nameRef, children, ...props }: LinkFormProps) {
  const id = useId();

  return (
    <div className="@container flex h-full min-h-0 w-full flex-1 flex-col bg-base">
      <div className="min-h-0 flex-1 overflow-auto">
        {children}
        <fieldset disabled={props.disabled} className="group/form grid gap-5 p-4 @min-[600px]:grid-cols-2">
          <fieldset className="space-y-3">
            <legend className="mb-3 text-xs font-semibold">Identity</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <FormLabel htmlFor={`${id}-name`}>Identifier</FormLabel>
                <LineEdit id={`${id}-name`} ref={nameRef} value={props.name} onChange={props.onNameChange} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <FormLabel htmlFor={`${id}-point`}>Point</FormLabel>
                <LineEdit
                  id={`${id}-point`}
                  value={props.point}
                  onChange={props.onPointChange}
                  onBlur={props.onPointBlur}
                  onKeyDown={props.onPointKeyDown}
                />
              </div>
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-xs font-semibold">Dimensions</legend>
            <div className="space-y-1.5">
              <FormLabel htmlFor={`${id}-type`}>Type</FormLabel>
              <ComboBox id={`${id}-type`} value={props.typeIndex} onChange={props.onTypeChange}>
                {props.typeOptions.map((type, index) => (
                  <option key={type} value={index}>
                    {type}
                  </option>
                ))}
              </ComboBox>
            </div>
            {props.circular ? (
              <div className="space-y-1.5">
                <FormLabel>Diameter</FormLabel>
                <EditableComboBox
                  label="Diameter"
                  value={props.sizeTexts.diameter}
                  items={props.parameterNames}
                  disabled={props.disabled}
                  placeholder={props.sizePlaceholder}
                  onTextChanged={props.sizeTextChanged('diameter')}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 space-y-1.5">
                  <FormLabel>A</FormLabel>
                  <EditableComboBox
                    label="A dimension"
                    value={props.sizeTexts.aSize}
                    items={props.parameterNames}
                    disabled={props.disabled}
                    placeholder={props.sizePlaceholder}
                    onTextChanged={props.sizeTextChanged('aSize')}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <FormLabel>B</FormLabel>
                  <EditableComboBox
                    label="B dimension"
                    value={props.sizeTexts.bSize}
                    items={props.parameterNames}
                    disabled={props.disabled}
                    placeholder={props.sizePlaceholder}
                    onTextChanged={props.sizeTextChanged('bSize')}
                  />
                </div>
              </div>
            )}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-xs font-semibold">Position</legend>
            <div className="grid grid-cols-3 gap-2">
              {props.positionFields.map((field, index) => (
                <div key={field.label} className="min-w-0 space-y-1.5">
                  <FormLabel htmlFor={`${id}-position-${index}`}>{field.label}</FormLabel>
                  <LineEdit
                    id={`${id}-position-${index}`}
                    className="font-code tabular-nums"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-xs font-semibold">Rotation</legend>
            <div className="space-y-1.5">
              <FormLabel>Orientation</FormLabel>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Orientation">
                {props.orientations.map((option) => (
                  <PushButton
                    key={option.label}
                    checked={option.selected}
                    aria-pressed={option.selected}
                    sizeClassName="h-7 min-w-9 px-2 text-[11px]"
                    onClick={option.onClick}
                  >
                    {option.label}
                  </PushButton>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {props.angleFields.map((field, index) => (
                <div key={field.label} className="min-w-0 space-y-1.5">
                  <FormLabel htmlFor={`${id}-angle-${index}`}>{field.label}</FormLabel>
                  <LineEdit
                    id={`${id}-angle-${index}`}
                    className="font-code tabular-nums"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </fieldset>
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-line bg-base px-4 py-3">
        <div
          role="status"
          className={cn(
            'max-h-16 min-w-0 flex-1 overflow-auto text-xs whitespace-pre-wrap text-muted-foreground select-text',
            props.statusIsError && 'text-error',
          )}
        >
          {props.status}
        </div>
        <PushButton variant="primary" sizeClassName="h-8 min-w-24 px-4" disabled={props.disabled} onClick={props.test}>
          Make
        </PushButton>
      </div>
    </div>
  );
}

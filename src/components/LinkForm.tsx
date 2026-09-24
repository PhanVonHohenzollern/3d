import { useId } from 'react';
import type { LinkFormProps } from '../types/linkForm';
import { cn } from '../utils/cn';
import { ComboBox } from './ui/ComboBox';
import { EditableComboBox } from './ui/EditableComboBox';
import { FormLabel } from './ui/FormLabel';
import { LineEdit } from './ui/LineEdit';
import { PushButton } from './ui/PushButton';

export function LinkForm({ nameRef, formRef, children, section, ...props }: LinkFormProps) {
  const id = useId();

  return (
    <div ref={formRef} className="@container flex h-full min-h-0 w-full flex-1 flex-col bg-base">
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
        <fieldset disabled={props.disabled} className="group/form p-1 [&_input]:h-7 [&_select[data-size=sm]]:h-7">
          <fieldset data-section="Identity" className={section === 'Identity' ? '' : 'hidden'}>
            <legend className="sr-only">Identity</legend>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 space-y-1">
                <FormLabel htmlFor={`${id}-name`}>Name</FormLabel>
                <LineEdit id={`${id}-name`} ref={nameRef} value={props.name} onChange={props.onNameChange} />
              </div>
              <div className="min-w-0 space-y-1">
                <FormLabel htmlFor={`${id}-point`}>Point variable</FormLabel>
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
          <fieldset
            data-section="Dimensions"
            className={section === 'Dimensions' ? 'grid grid-cols-2 gap-2' : 'hidden'}
          >
            <legend className="sr-only">Dimensions</legend>
            <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 space-y-1">
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
                <div className="min-w-0 space-y-1">
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
          <fieldset data-section="Position" className={section === 'Position' ? '' : 'hidden'}>
            <legend className="sr-only">Position</legend>
            <div className="grid grid-cols-3 gap-2">
              {props.positionFields.map((field, index) => (
                <div key={field.label} className="min-w-0 space-y-1">
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
          <fieldset
            data-section="Rotation"
            className={section === 'Rotation' ? 'grid grid-cols-[80px_minmax(0,1fr)] gap-2' : 'hidden'}
          >
            <legend className="sr-only">Rotation</legend>
            <div className="space-y-1">
              <FormLabel>Orientation</FormLabel>
              <ComboBox
                aria-label="Orientation"
                value={props.orientations.findIndex((option) => option.selected)}
                onChange={(event) => props.orientations[Number(event.target.value)]?.onClick()}
              >
                {props.orientations.map((option, index) => (
                  <option key={option.label} value={index}>
                    {option.label}
                  </option>
                ))}
              </ComboBox>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {props.angleFields.map((field, index) => (
                <div key={field.label} className="min-w-0 space-y-1">
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
      <div className="flex shrink-0 items-center gap-2 border-t border-line bg-base px-1.5 py-1">
        <PushButton sizeClassName="h-7 px-2" onClick={props.previousStep}>
          Back
        </PushButton>
        <div
          role="status"
          title={props.feedback}
          className={cn(
            'min-w-0 flex-1 truncate text-[11px] text-muted-foreground select-text',
            props.statusIsError && 'text-error',
          )}
        >
          {props.feedback}
        </div>
        {props.lastStep ? (
          <PushButton
            variant="primary"
            sizeClassName="h-7 min-w-16 px-3"
            disabled={props.disabled}
            onClick={props.test}
          >
            Make
          </PushButton>
        ) : (
          <PushButton
            variant="primary"
            sizeClassName="h-7 px-3"
            disabled={props.disabled || !props.canContinue}
            onClick={props.nextStep}
          >
            {props.nextLabel}
          </PushButton>
        )}
      </div>
    </div>
  );
}

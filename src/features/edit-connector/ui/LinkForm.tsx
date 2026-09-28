import { useId } from 'react';
import type { LinkFormProps } from '@/features/edit-connector/ui/types';
import { cn } from '@/shared/lib/cn';
import { ComboBox } from '@/shared/ui/ComboBox';
import { EditableComboBox } from '@/shared/ui/editable-combo-box';
import { FormLabel } from '@/shared/ui/FormLabel';
import { LineEdit } from '@/shared/ui/LineEdit';
import { PushButton } from '@/shared/ui/PushButton';
import { Button } from '@/shared/ui/button';

export const LinkForm = ({ disabled, nameRef, identity, size, position, rotation, status }: LinkFormProps) => {
  const id = useId();

  return (
    <div className="@container/link-form flex h-full min-h-0 w-full flex-1 flex-col bg-base">
      <fieldset
        disabled={disabled}
        aria-label="Connector settings"
        className="group/form m-2 grid shrink-0 grid-cols-1 gap-x-5 gap-y-3 rounded-md border border-line p-3 @min-[520px]/link-form:grid-cols-2 @min-[960px]/link-form:grid-cols-4 [&_input]:h-7 [&_select[data-size=sm]]:h-7"
      >
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="mb-2 text-xs font-semibold">Name</legend>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
            <FormLabel htmlFor={`${id}-name`}>Name</FormLabel>
            <LineEdit
              id={`${id}-name`}
              ref={nameRef}
              value={identity.name}
              onChange={identity.onNameChange}
              aria-invalid={!!identity.nameError}
              title={identity.nameError}
            />
            <FormLabel htmlFor={`${id}-point`}>Point variable</FormLabel>
            <LineEdit
              id={`${id}-point`}
              value={identity.point}
              onChange={identity.onPointChange}
              onBlur={identity.onPointBlur}
              onKeyDown={identity.onPointKeyDown}
            />
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="mb-2 text-xs font-semibold">Size</legend>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
            <FormLabel htmlFor={`${id}-type`}>Type</FormLabel>
            <ComboBox
              id={`${id}-type`}
              value={size.typeIndex}
              onChange={size.onTypeChange}
              aria-invalid={!!size.errors.type}
            >
              {size.typeOptions.map((type, index) => (
                <option key={type} value={index}>
                  {type}
                </option>
              ))}
            </ComboBox>
            {size.circular ? (
              <>
                <FormLabel>Diameter</FormLabel>
                <EditableComboBox
                  compact
                  label="Diameter"
                  value={size.texts.diameter}
                  items={size.parameterNames}
                  disabled={disabled}
                  placeholder={size.placeholder}
                  onTextChanged={size.onTextChanged('diameter')}
                  invalid={!!size.errors.diameter}
                />
              </>
            ) : (
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {(['aSize', 'bSize'] as const).map((field, index) => (
                  <div key={field} className="flex min-w-0 items-center gap-2">
                    <FormLabel>{index === 0 ? 'A' : 'B'}</FormLabel>
                    <EditableComboBox
                      compact
                      label={index === 0 ? 'A dimension' : 'B dimension'}
                      value={size.texts[field]}
                      items={size.parameterNames}
                      disabled={disabled}
                      placeholder={size.placeholder}
                      onTextChanged={size.onTextChanged(field)}
                      invalid={!!size.errors[field]}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-semibold">Position</legend>
          <div className="grid grid-cols-3 gap-2">
            {position.map((field, index) => (
              <div key={field.label} className="min-w-0 space-y-1.5">
                <FormLabel htmlFor={`${id}-position-${index}`}>{field.label}</FormLabel>
                <LineEdit
                  id={`${id}-position-${index}`}
                  className="px-2 font-code tabular-nums"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="mb-2 text-xs font-semibold">Rotation</legend>
          <div className="space-y-1.5">
            <FormLabel>Orientation</FormLabel>
            <div role="group" aria-label="Orientation" className="grid grid-cols-6 gap-1">
              {rotation.orientations.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  size="xs"
                  className="min-w-0 px-1"
                  variant={option.selected ? 'default' : 'outline'}
                  aria-pressed={option.selected}
                  onClick={option.onClick}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {rotation.angles.map((field, index) => (
              <div key={field.label} className="min-w-0 space-y-1.5">
                <FormLabel htmlFor={`${id}-angle-${index}`} title={field.label}>
                  {field.label.replace(' (deg)', '°')}
                </FormLabel>
                <LineEdit
                  id={`${id}-angle-${index}`}
                  aria-label={field.label}
                  className="px-2 font-code tabular-nums"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </fieldset>
      </fieldset>
      <div className="mt-auto flex shrink-0 items-center gap-3 border-t border-line bg-base px-3 py-1.5">
        <div
          role={status.isError ? 'alert' : 'status'}
          className={cn(
            'min-w-0 flex-1 text-[11px] break-words text-muted-foreground select-text',
            status.isError && 'text-error',
          )}
        >
          {status.feedback}
        </div>
        <PushButton
          variant="primary"
          sizeClassName="h-7 min-w-16 shrink-0 px-3"
          disabled={disabled}
          onClick={status.test}
        >
          Make
        </PushButton>
      </div>
    </div>
  );
};

import { useEditableComboBox } from '../../hooks/useEditableComboBox';
import { cn } from '../../utils/cn';
import { preventDefault } from '../../utils/events';
import { LineEdit } from './LineEdit';
import { useId, type KeyboardEvent } from 'react';

interface EditableComboBoxProps {
  value: string;
  label?: string;
  compact?: boolean;
  items: readonly string[];
  disabled?: boolean;
  placeholder?: string;
  onTextChanged: (text: string) => void;
  invalid?: boolean;
  onItemSelected?: (index: number) => void;
  selectedIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function EditableComboBox({
  value,
  label,
  compact = false,
  items,
  disabled,
  placeholder,
  onTextChanged,
  invalid,
  onItemSelected,
  selectedIndex,
  onFocus,
  onBlur,
  onKeyDown: onInputKeyDown,
}: EditableComboBoxProps) {
  const listId = useId();
  const { rootRef, open, popupRect, onKeyDown, onChange, toggle, choose, close } = useEditableComboBox(
    value,
    items,
    onTextChanged,
    onItemSelected,
    selectedIndex,
  );

  return (
    <div ref={rootRef} className={cn('relative flex', compact ? 'min-w-0 flex-1' : 'min-w-[100px]')}>
      <LineEdit
        className={cn('flex-1 rounded-r-none', compact && 'h-7 px-2')}
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
        aria-invalid={invalid}
        onFocus={onFocus}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        onKeyDown={(event) => {
          onKeyDown(event);
          if (!event.defaultPrevented) onInputKeyDown?.(event);
        }}
      />
      <button
        type="button"
        aria-label={label ? `Show values for ${label}` : 'Show parameter suggestions'}
        aria-expanded={open}
        className={cn(
          'relative w-7 shrink-0 rounded-r-md border border-l-0 border-line bg-base hover:bg-secondary',
          compact ? 'h-7' : 'h-8',
        )}
        disabled={disabled}
        tabIndex={-1}
        onMouseDown={preventDefault}
        onClick={toggle}
      >
        <span
          className={cn(
            'absolute top-1/2 left-2 -translate-y-1/4 border-4 border-transparent',
            disabled ? 'border-t-arrow-disabled' : 'border-t-arrow',
          )}
        />
      </button>
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label ? `Values for ${label}` : 'Parameter suggestions'}
          className="fixed z-60 mt-1 max-h-[220px] list-none overflow-auto rounded-md border border-line bg-base p-1 shadow-lg empty:hidden"
          style={popupRect}
        >
          {items.map((item, index) => (
            <li
              key={index}
              role="option"
              aria-selected={selectedIndex === undefined ? item === value : selectedIndex === index}
              className={cn(
                'rounded-sm px-2 py-1.5 text-xs whitespace-nowrap hover:bg-secondary',
                (selectedIndex === undefined ? item === value : selectedIndex === index) && 'bg-secondary font-bold',
              )}
              onMouseDown={preventDefault}
              onClick={choose(index)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEditableComboBox } from '../../hooks/useEditableComboBox';
import { cn } from '../../utils/cn';
import { preventDefault } from '../../utils/events';
import { LineEdit } from './LineEdit';

interface EditableComboBoxProps {
  value: string;
  label?: string;
  items: readonly string[];
  disabled: boolean;
  placeholder: string;
  onTextChanged: (text: string) => void;
}

export function EditableComboBox({ value, label, items, disabled, placeholder, onTextChanged }: EditableComboBoxProps) {
  const { rootRef, open, popupRect, onKeyDown, onChange, toggle, choose } = useEditableComboBox(
    value,
    items,
    onTextChanged,
  );

  return (
    <div ref={rootRef} className="relative flex min-w-[100px]">
      <LineEdit
        className="flex-1 rounded-r-none"
        aria-label={label}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        aria-label="Show parameter suggestions"
        aria-expanded={open}
        className="relative h-8 w-7 rounded-r-md border border-l-0 border-line bg-base hover:bg-secondary"
        disabled={disabled}
        tabIndex={-1}
        onMouseDown={preventDefault}
        onClick={toggle}
      >
        <span
          className={cn(
            'absolute top-3.5 left-2 border-4 border-transparent',
            disabled ? 'border-t-arrow-disabled' : 'border-t-arrow',
          )}
        />
      </button>
      {open && !disabled && (
        <ul
          className="fixed z-60 mt-1 max-h-[220px] list-none overflow-auto rounded-md border border-line bg-base p-1 shadow-lg empty:hidden"
          style={popupRect}
        >
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                'rounded-sm px-2 py-1.5 text-xs whitespace-nowrap hover:bg-secondary',
                item === value && 'font-bold',
              )}
              onMouseDown={preventDefault}
              onClick={choose(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

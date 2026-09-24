import { useEditableComboBox } from '../../hooks/useEditableComboBox';
import { cn } from '../../utils/cn';
import { preventDefault } from '../../utils/events';
import { LineEdit } from './LineEdit';

interface EditableComboBoxProps {
  value: string;
  label?: string;
  compact?: boolean;
  items: readonly string[];
  disabled: boolean;
  placeholder: string;
  onTextChanged: (text: string) => void;
}

export function EditableComboBox({
  value,
  label,
  compact = false,
  items,
  disabled,
  placeholder,
  onTextChanged,
}: EditableComboBoxProps) {
  const { rootRef, open, popupRect, onKeyDown, onChange, toggle, choose } = useEditableComboBox(
    value,
    items,
    onTextChanged,
  );

  return (
    <div ref={rootRef} className={cn('relative flex', compact ? 'min-w-0 flex-1' : 'min-w-[100px]')}>
      <LineEdit
        className={cn('flex-1 rounded-r-none', compact && 'h-7 px-2')}
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

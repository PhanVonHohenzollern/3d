import { useEditableComboBox } from '../../hooks/useEditableComboBox';
import { cn } from '../../utils/cn';
import { preventDefault } from '../../utils/events';
import { LineEdit } from './LineEdit';

interface EditableComboBoxProps {
  value: string;
  items: readonly string[];
  disabled: boolean;
  placeholder: string;
  onTextChanged: (text: string) => void;
}

export function EditableComboBox({ value, items, disabled, placeholder, onTextChanged }: EditableComboBoxProps) {
  const { rootRef, open, popupRect, onKeyDown, onChange, toggle, choose } = useEditableComboBox(
    value,
    items,
    onTextChanged,
  );

  return (
    <div ref={rootRef} className="relative flex min-w-[100px]">
      <LineEdit
        className="flex-1 rounded-r-none"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="relative h-6 w-5 rounded-r-[2px] border border-l-0 border-line-strong bg-linear-to-b/srgb from-button-top to-button-bottom"
        disabled={disabled}
        tabIndex={-1}
        onMouseDown={preventDefault}
        onClick={toggle}
      >
        <span
          className={cn(
            'absolute top-2.5 left-1.5 border-4 border-transparent',
            disabled ? 'border-t-arrow-disabled' : 'border-t-arrow',
          )}
        />
      </button>
      {open && !disabled && (
        <ul
          className="fixed z-60 mt-px max-h-[220px] list-none overflow-auto border border-line-strong bg-base py-0.5 shadow-[0_3px_8px_rgba(0,0,0,0.2)] empty:hidden"
          style={popupRect}
        >
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                'px-2 py-0.5 whitespace-nowrap hover:bg-highlight hover:text-highlight-fg',
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

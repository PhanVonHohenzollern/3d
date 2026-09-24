import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

export function useEditableComboBox(value: string, items: readonly string[], onTextChanged: (text: string) => void) {
  const [open, setOpen] = useState(false);
  const [popupRect, setPopupRect] = useState({ left: 0, top: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close, true);
    return () => window.removeEventListener('mousedown', close, true);
  }, [open]);

  const openPopup = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setPopupRect({ left: rect.left, top: rect.bottom + 1, width: rect.width });
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length && !event.altKey) {
      event.preventDefault();
      const index = items.indexOf(value);
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
      if (items[next] !== undefined && items[next] !== value) onTextChanged(items[next]);
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      openPopup();
    }
  };

  return {
    rootRef,
    open,
    popupRect,
    onKeyDown,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onTextChanged(event.target.value),
    toggle: () => (open ? setOpen(false) : openPopup()),
    choose: (item: string) => () => {
      setOpen(false);
      onTextChanged(item);
    },
  };
}

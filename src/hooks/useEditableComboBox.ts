import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

export function useEditableComboBox(
  value: string,
  items: readonly string[],
  onTextChanged: (text: string) => void,
  onItemSelected?: (index: number) => void,
  selectedIndex?: number,
) {
  const [open, setOpen] = useState(false);
  const [popupRect, setPopupRect] = useState({ left: 0, top: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const closePopup = () => setOpen(false);

    window.addEventListener('mousedown', close, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', closePopup);

    return () => {
      window.removeEventListener('mousedown', close, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', closePopup);
    };
  }, [open]);

  const openPopup = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const height = Math.min(220, items.length * 32 + 8);
      const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
      setPopupRect({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 1 : Math.max(8, rect.top - height - 4),
        width,
      });
    }
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
      const index = selectedIndex ?? items.indexOf(value);
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
      if (items[next] !== undefined) {
        if (onItemSelected) onItemSelected(next);
        else if (items[next] !== value) onTextChanged(items[next]);
      }
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      openPopup();
    }
  };

  return {
    rootRef,
    open,
    popupRect,
    close: () => setOpen(false),
    onKeyDown,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onTextChanged(event.target.value),
    toggle: () => (open ? setOpen(false) : openPopup()),
    choose: (index: number) => () => {
      setOpen(false);
      if (onItemSelected) onItemSelected(index);
      else onTextChanged(items[index]);
    },
  };
}

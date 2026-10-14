import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

export function useEditableComboBox(
  value: string,
  items: readonly string[],
  onTextChanged: (text: string) => void,
  onItemSelected?: (index: number) => void,
  selectedIndex?: number,
  searchable = false,
) {
  const [open, setOpen] = useState(false);
  const [popupRect, setPopupRect] = useState({ left: 0, top: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !searchable || item.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

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
      const index = visibleItems.findIndex((item) => item.index === (selectedIndex ?? items.indexOf(value)));
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, visibleItems.length - 1) : Math.max(index - 1, 0);
      const selected = visibleItems[next];
      if (selected !== undefined) {
        if (onItemSelected) onItemSelected(selected.index);
        else if (selected.item !== value) onTextChanged(selected.item);
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
    visibleItems,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (searchable) {
        setQuery(event.target.value);
        openPopup();
      }
      onTextChanged(event.target.value);
    },
    toggle: () => {
      setQuery('');
      if (open) setOpen(false);
      else openPopup();
    },
    choose: (index: number) => () => {
      setOpen(false);
      if (onItemSelected) onItemSelected(index);
      else onTextChanged(items[index]);
    },
  };
}

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { stripMnemonic } from '../helpers/keyboard';
import type { Menu } from '../types/mainWindow';

export function useMenuBar(menus: readonly Menu[]) {
  const [open, setOpen] = useState(-1);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open < 0) return;
    const onPointerDown = (event: Event) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(-1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(-1);
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const titleMouseDown = (index: number) => (event: MouseEvent) => {
    event.preventDefault();
    setOpen(open === index ? -1 : index);
  };
  const titleMouseEnter = (index: number) => () => {
    if (open >= 0 && open !== index) setOpen(index);
  };
  const close = () => setOpen(-1);

  const titles = menus.map((menu) => stripMnemonic(menu.title));

  return { barRef, open, titles, titleMouseDown, titleMouseEnter, close };
}

// QMenuBar/QMenu and QToolBar rendering of the MainWindow actions. Menus open
// on click, follow the pointer between titles while open, and close on Esc,
// on an outside click or after triggering an item. Tool buttons never take
// keyboard focus (like QToolButton in a QToolBar). No tooltips (main.cpp
// suppresses them application-wide).

import { useEffect, useRef, useState } from 'react';
import { useObservable } from '../ui/Observable';
import { keySequenceText, stripMnemonic, type Action } from './Action';

export type ActionListItem = Action | 'separator';

export interface Menu {
  title: string;
  items: readonly ActionListItem[];
}

function MenuItem({ action, onTriggered }: { action: Action; onTriggered: () => void }) {
  useObservable(action);
  const shortcut = action.shortcut();
  return (
    <li
      className="menu-item"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onTriggered(); action.trigger(); }}
    >
      <span className="menu-check">{action.isCheckable() && action.isChecked() ? '\u2713' : ''}</span>
      <span className="menu-text">{stripMnemonic(action.text)}</span>
      <span className="menu-shortcut">{shortcut ? keySequenceText(shortcut) : ''}</span>
    </li>
  );
}

export function MenuBar({ menus }: { menus: readonly Menu[] }) {
  const [open, setOpen] = useState(-1);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open < 0) return;
    const onPointerDown = (event: Event) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(-1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // An open menu takes the keyboard: Esc closes it and is no window shortcut.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(-1);
      }
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={barRef} className="menubar" role="menubar">
      {menus.map((menu, index) => (
        <div key={menu.title} className="menubar-entry">
          <button
            type="button"
            className={`menubar-title${open === index ? ' open' : ''}`}
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); setOpen(open === index ? -1 : index); }}
            onMouseEnter={() => { if (open >= 0 && open !== index) setOpen(index); }}
          >
            {stripMnemonic(menu.title)}
          </button>
          {open === index && (
            <ul className="menu" role="menu">
              {menu.items.map((item, i) => item === 'separator'
                ? <li key={`separator-${i}`} className="menu-separator" role="separator" />
                : <MenuItem key={item.text} action={item} onTriggered={() => setOpen(-1)} />)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ToolButton({ action }: { action: Action }) {
  useObservable(action);
  const checked = action.isCheckable() && action.isChecked();
  return (
    <button
      type="button"
      className={`toolbar-button${checked ? ' checked' : ''}`}
      aria-pressed={action.isCheckable() ? checked : undefined}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => action.trigger()}
    >
      {action.iconText()}
    </button>
  );
}

export function ToolBar({ items }: { items: readonly ActionListItem[] }) {
  return (
    <div className="toolbar" role="toolbar">
      <span className="toolbar-handle" />
      {items.map((item, i) => item === 'separator'
        ? <span key={`separator-${i}`} className="toolbar-separator" />
        : <ToolButton key={item.text} action={item} />)}
    </div>
  );
}

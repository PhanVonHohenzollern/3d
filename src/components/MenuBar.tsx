import type { KeyboardEvent } from 'react';
import { useAction } from '../hooks/useAction';
import { useMenuBar } from '../hooks/useMenuBar';
import type { Action } from '../hooks/mainWindow/Action';
import type { Menu } from '../types/mainWindow';
import { cn } from '../utils/cn';

function MenuItem({ action, onTriggered }: { action: Action; onTriggered: () => void }) {
  const { menuText, shortcutText, checked, trigger } = useAction(action, onTriggered);

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        className="flex h-8 w-full items-center rounded-sm px-2 text-left text-xs whitespace-nowrap hover:bg-secondary focus:bg-secondary focus:outline-none"
        onClick={trigger}
      >
        <span className="w-5 text-center">{checked ? '\u2713' : ''}</span>
        <span className="flex-1">{menuText}</span>
        <span className="ml-6 font-code text-[10px] text-muted">{shortcutText}</span>
      </button>
    </li>
  );
}

export function MenuBar({ menus }: { menus: readonly Menu[] }) {
  const { barRef, open, titles, titleMouseDown, titleMouseEnter, close } = useMenuBar(menus);

  const navigateMenu = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <nav ref={barRef} aria-label="Application menu" className="flex shrink-0 items-center gap-0.5">
      {menus.map((menu, index) => (
        <div key={menu.title} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open === index}
            className={cn(
              'h-8 rounded-md px-2.5 text-xs font-medium transition-colors',
              open === index ? 'bg-secondary text-fg' : 'text-muted hover:bg-secondary hover:text-fg',
            )}
            onMouseDown={titleMouseDown(index)}
            onMouseEnter={titleMouseEnter(index)}
            onClick={(event) => {
              if (event.detail === 0) titleMouseDown(index)(event);
            }}
          >
            {titles[index]}
          </button>
          {open === index && (
            <ul
              role="menu"
              aria-label={titles[index]}
              onKeyDown={navigateMenu}
              className="absolute top-[calc(100%+8px)] right-0 z-50 m-0 min-w-[240px] list-none rounded-md border border-line bg-base p-1 shadow-lg"
            >
              {menu.items.map((item, i) =>
                item === 'separator' ? (
                  <li key={`separator-${i}`} role="separator" className="my-1 h-px bg-line" />
                ) : (
                  <MenuItem key={item.text} action={item} onTriggered={close} />
                ),
              )}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}

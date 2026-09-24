import { useAction } from '../hooks/useAction';
import type { Action } from '../hooks/mainWindow/Action';
import { useMenuBar } from '../hooks/useMenuBar';
import type { Menu } from '../types/mainWindow';
import { cn } from '../utils/cn';
import { preventDefault } from '../utils/events';

function MenuItem({ action, onTriggered }: { action: Action; onTriggered: () => void }) {
  const { menuText, shortcutText, checked, trigger } = useAction(action, onTriggered);

  return (
    <li
      role="menuitem"
      className="flex h-6 cursor-default items-center pr-3 pl-1 whitespace-nowrap hover:bg-highlight hover:text-highlight-fg"
      onMouseDown={preventDefault}
      onClick={trigger}
    >
      <span className="w-5 text-center">{checked ? '\u2713' : ''}</span>
      <span className="flex-1">{menuText}</span>
      <span className="ml-7 opacity-75">{shortcutText}</span>
    </li>
  );
}

export function MenuBar({ menus }: { menus: readonly Menu[] }) {
  const { barRef, open, titles, titleMouseDown, titleMouseEnter, close } = useMenuBar(menus);

  return (
    <div ref={barRef} role="menubar" className="flex h-6 flex-none border-b border-line bg-window px-0.5">
      {menus.map((menu, index) => (
        <div key={menu.title} className="relative">
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              'h-full border-none px-[9px]',
              open === index
                ? 'bg-highlight text-highlight-fg'
                : 'bg-transparent text-fg hover:bg-highlight hover:text-highlight-fg',
            )}
            onMouseDown={titleMouseDown(index)}
            onMouseEnter={titleMouseEnter(index)}
          >
            {titles[index]}
          </button>
          {open === index && (
            <ul
              role="menu"
              className="absolute top-full left-0 z-50 m-0 min-w-[220px] list-none border border-line-strong bg-base py-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.22)]"
            >
              {menu.items.map((item, i) =>
                item === 'separator' ? (
                  <li key={`separator-${i}`} role="separator" className="my-[3px] h-px bg-line" />
                ) : (
                  <MenuItem key={item.text} action={item} onTriggered={close} />
                ),
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

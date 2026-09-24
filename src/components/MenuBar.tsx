import { stripMnemonic } from '../helpers/keyboard';
import { useAction } from '../hooks/useAction';
import type { Action } from '../hooks/mainWindow/Action';
import type { Menu } from '../types/mainWindow';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from './ui/dropdown-menu';

function MenuItem({ action }: { action: Action }) {
  const { menuText, shortcutText, checkable, checked, trigger } = useAction(action);
  const content = (
    <>
      {menuText}
      <DropdownMenuShortcut>{shortcutText}</DropdownMenuShortcut>
    </>
  );

  return checkable ? (
    <DropdownMenuCheckboxItem checked={checked} onSelect={trigger} className="text-xs">
      {content}
    </DropdownMenuCheckboxItem>
  ) : (
    <DropdownMenuItem onSelect={trigger} inset className="text-xs">
      {content}
    </DropdownMenuItem>
  );
}

export function MenuBar({ menus }: { menus: readonly Menu[] }) {
  return (
    <nav aria-label="Application menu" className="flex shrink-0 items-center gap-0.5">
      {menus.map((menu) => (
        <DropdownMenu key={menu.title}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              {stripMnemonic(menu.title)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            {menu.items.map((item, i) =>
              item === 'separator' ? (
                <DropdownMenuSeparator key={`separator-${i}`} />
              ) : (
                <MenuItem key={item.text} action={item} />
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </nav>
  );
}

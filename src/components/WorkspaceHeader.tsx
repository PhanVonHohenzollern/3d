import { Box, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { Menu } from '../types/mainWindow';
import { MenuBar } from './MenuBar';

export function WorkspaceHeader({ menus }: { menus: readonly Menu[] }) {
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === 'light' ? Moon : Sun;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-base px-4 sm:px-6">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Box className="size-[19px]" strokeWidth={1.7} aria-hidden />
      </div>
      <h1 className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">Geometry Preview</h1>
      <span className="hidden text-[10px] font-medium tracking-[0.12em] text-muted xl:inline">WORKSPACE</span>
      <div className="flex-1" />
      <MenuBar menus={menus} />
      <span className="hidden items-center gap-2 rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium sm:flex">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Live preview
      </span>
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-base text-muted transition-colors hover:bg-secondary hover:text-fg"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        onClick={toggleTheme}
      >
        <ThemeIcon className="size-4" aria-hidden />
      </button>
    </header>
  );
}

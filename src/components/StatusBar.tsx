import { CircleCheck, Terminal } from 'lucide-react';
import type { StatusBarModel } from '../hooks/mainWindow/StatusBarModel';
import { useStatusBar } from '../hooks/useStatusBar';

export function StatusBar({ model }: { model: StatusBarModel }) {
  const message = useStatusBar(model);

  return (
    <footer className="flex h-8 shrink-0 items-center gap-2 border-t border-line px-4 text-[11px] text-muted sm:px-6">
      <Terminal className="size-3 shrink-0" aria-hidden />
      <span role="status" className="min-w-0 flex-1 truncate">
        {message || 'Ready'}
      </span>
      <span className="hidden items-center gap-1.5 sm:flex">
        <CircleCheck className="size-3" aria-hidden /> Local runtime
      </span>
    </footer>
  );
}

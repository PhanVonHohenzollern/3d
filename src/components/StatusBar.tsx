import type { StatusBarModel } from '../hooks/mainWindow/StatusBarModel';
import { useStatusBar } from '../hooks/useStatusBar';

export function StatusBar({ model }: { model: StatusBarModel }) {
  const message = useStatusBar(model);

  return (
    <div className="h-[22px] flex-none overflow-hidden border-t border-line bg-window px-1.5 leading-[22px] text-ellipsis whitespace-nowrap">
      {message}
    </div>
  );
}

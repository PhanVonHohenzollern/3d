import type { StatusBarModel } from '../hooks/mainWindow/StatusBarModel';

export type StatusTone = 'info' | 'warning' | 'error';

export interface StatusBarProps {
  model: StatusBarModel;
}

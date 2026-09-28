import { useTheme } from '@/app/model/useTheme';
import { WorkspacePage } from '@/pages/workspace';

export function App() {
  const { theme, toggleTheme } = useTheme();

  return <WorkspacePage theme={theme} onToggleTheme={toggleTheme} />;
}

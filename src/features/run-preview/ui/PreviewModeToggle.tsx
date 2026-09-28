import type { PreviewMode } from '@/features/run-preview/model/types';
import { Button } from '@/shared/ui/button';

type PreviewModeToggleProps = {
  mode: PreviewMode;
  debugBlocked: boolean;
  onBuild: () => void;
  onDebug: () => void;
};

export const PreviewModeToggle = ({ mode, debugBlocked, onBuild, onDebug }: PreviewModeToggleProps) => (
  <div role="group" aria-label="Preview mode" className="flex shrink-0 items-center gap-1">
    <Button
      size="xs"
      variant={mode === 'build' ? 'default' : 'outline'}
      aria-pressed={mode === 'build'}
      title="Run all code; preview holds until next Build"
      onClick={onBuild}
    >
      Build
    </Button>
    <Button
      size="xs"
      variant={mode === 'debug' ? 'default' : 'outline'}
      aria-pressed={mode === 'debug'}
      disabled={debugBlocked}
      title={debugBlocked ? 'Code changed · Build to enable Debug' : 'Run to the cursor line; preview follows edits'}
      onClick={onDebug}
    >
      Debug
    </Button>
  </div>
);

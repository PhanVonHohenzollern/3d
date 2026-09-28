import { Download, Upload } from 'lucide-react';
import type { ModelFileControlsProps } from '@/features/model-files/ui/types';
import { Button } from '@/shared/ui/button';

export function ModelFileControls({
  inputRef,
  busy,
  canExport,
  chooseFile,
  importFile,
  exportFile,
}: ModelFileControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".obj"
        className="hidden"
        aria-label="Choose OBJ file"
        onChange={importFile}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={chooseFile}
        aria-label="Import"
        title="Import OBJ into the preview (code is kept)"
      >
        <Upload className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">{busy ? 'Importing…' : 'Import'}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !canExport}
        onClick={exportFile}
        aria-label="Export"
        title={canExport ? 'Export model as OBJ' : 'No model to export yet'}
      >
        <Download className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Export</span>
      </Button>
    </div>
  );
}

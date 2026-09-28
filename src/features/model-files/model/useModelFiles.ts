import { useRef, useState, type ChangeEvent } from 'react';
import { readObjFile, type ImportedModel } from '@/features/model-files/model/modelFiles';
import type { ModelFileControlsProps } from '@/features/model-files/ui/types';
import { downloadText } from '@/shared/lib/download';
import { what } from '@engine/runtime';

// What the page provides: show an imported model, and the OBJ text of what is on screen.
export type ModelFileHost = {
  canExport: boolean;
  importedName: string | null;
  showImported: (model: ImportedModel) => void;
  exportText: () => string;
};

export function useModelFiles(host: ModelFileHost) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const { model, message } = await readObjFile(file);
      host.showImported(model);
      setMessage(message);
      setError(false);
    } catch (cause) {
      setMessage(what(cause) || 'The OBJ could not be imported.');
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const exportFile = () => {
    try {
      downloadText(host.exportText(), host.importedName ?? 'geometry-preview.obj');
      setMessage('OBJ exported. Includes mesh geometry and normals; materials and textures are not included.');
      setError(false);
    } catch (cause) {
      setMessage(what(cause) || 'The model could not be exported.');
      setError(true);
    }
  };

  const chooseFile = () => inputRef.current?.click();

  const dismissMessage = () => setMessage('');

  const controls: ModelFileControlsProps = {
    inputRef,
    busy,
    canExport: host.canExport,
    chooseFile,
    importFile,
    exportFile,
  };

  return { controls, message, error, dismissMessage };
}

import { OBJ_MAX_BYTES, parseObj, writeObj } from '@engine/formats';
import type { ConnectorPreview, PreviewGeometryScene } from '@engine/geometry';

export type ImportedModel = { name: string; scene: PreviewGeometryScene };

// What Export OBJ writes: the imported model, or the code's meshes plus the shown connector previews.
export function exportableScene(
  imported: ImportedModel | null,
  codeScene: PreviewGeometryScene,
  connectorPreviews: readonly ConnectorPreview[],
): PreviewGeometryScene {
  return (
    imported?.scene ?? {
      meshes: [...codeScene.meshes, ...connectorPreviews.flatMap((preview) => preview.meshes)],
      warnings: [],
    }
  );
}

export function canExportModel(
  imported: ImportedModel | null,
  codeScene: PreviewGeometryScene,
  connectorPreviews: readonly ConnectorPreview[],
): boolean {
  return exportableScene(imported, codeScene, connectorPreviews).meshes.length > 0;
}

export function exportedObjText(
  imported: ImportedModel | null,
  codeScene: PreviewGeometryScene,
  connectorPreviews: readonly ConnectorPreview[],
): string {
  return writeObj(exportableScene(imported, codeScene, connectorPreviews));
}

// Throws an Error with a message for the user when the file is not a usable OBJ.
export async function readObjFile(file: File): Promise<{ model: ImportedModel; message: string }> {
  if (!/\.obj$/i.test(file.name)) throw new Error('Choose a .obj file.');
  if (file.size > OBJ_MAX_BYTES) throw new Error('OBJ files must be 20 MB or smaller.');
  const scene = parseObj(await file.text());
  const triangles = scene.meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0);

  return {
    model: { name: file.name, scene },
    message: `Imported ${file.name}: ${triangles.toLocaleString()} triangles.${scene.warnings.length ? ` ${scene.warnings.join(' ')}` : ''}`,
  };
}

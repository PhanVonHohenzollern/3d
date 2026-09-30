import type { RenderBackend } from '@/widgets/viewport/lib/render/backend/RenderBackend';
import { WebGL2Backend } from '@/widgets/viewport/lib/render/backend/WebGL2Backend';

// The backend the viewport draws with.
export function createRenderBackend(): RenderBackend {
  return new WebGL2Backend();
}

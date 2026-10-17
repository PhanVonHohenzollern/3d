import registry from 'virtual:flm-libraries';
import { createJsonLibrary } from '@/features/element-library/model/jsonLibrary';
import type { LibraryAsset } from '@/features/element-library/model/types';

// The Vite virtual manifest must scan JSON, C++ (.h/.cpp) and SVG files.
// Never mix these libraries with a legacy XML/runtime-default registry.
export const libraries: LibraryAsset[] = registry.map((asset) => ({
  name: asset.name,
  catalog: asset.catalog,
  sources: asset.sources,
  load: async () => createJsonLibrary(asset.name, await asset.load(), asset.entries),
}));

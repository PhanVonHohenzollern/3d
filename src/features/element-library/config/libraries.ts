import type { LibraryAsset } from '@/features/element-library/model/types';

export const libraries: LibraryAsset[] = [
  ['CGeneral', 'CGeneral'],
  ['GRUNDFOS', 'GRUNDFOS'],
  ['BELIMO', 'CBELIMO'],
].map(([name, source]) => ({
  name,
  presets: `demo/presets/${name}.json`,
  sources: ['h', 'cpp'].map((extension) => ({
    name: `${source}.${extension}`,
    path: `demo/code/${name}/${source}.${extension}`,
  })),
}));

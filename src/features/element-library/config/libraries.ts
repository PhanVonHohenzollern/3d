import type { LibraryAsset } from '@/features/element-library/model/types';

function sources(name: string, source = name): LibraryAsset['sources'] {
  return ['h', 'cpp'].map((extension) => ({
    name: `${source}.${extension}`,
    path: `demo/code/${name}/${source}.${extension}`,
  }));
}

export const libraries: LibraryAsset[] = [
  {
    name: 'CGeneral',
    load: () => import('@/features/element-library/data/CGeneral').then((module) => module.default),
    sources: sources('CGeneral'),
  },
  {
    name: 'GRUNDFOS',
    load: () => import('@/features/element-library/data/GRUNDFOS').then((module) => module.default),
    sources: sources('GRUNDFOS'),
  },
  {
    name: 'BELIMO',
    load: () => import('@/features/element-library/data/BELIMO').then((module) => module.default),
    sources: sources('BELIMO', 'CBELIMO'),
  },
];

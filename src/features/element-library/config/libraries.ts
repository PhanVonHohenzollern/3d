import type { LibraryAsset } from '@/features/element-library/model/types';
import catalog from '@/features/element-library/config/catalog.json';

function sources(name: string, source = name): LibraryAsset['sources'] {
  return ['h', 'cpp'].map((extension) => ({
    name: `${source}.${extension}`,
    path: `demo/code/${name}/${source}.${extension}`,
  }));
}

export const libraries: LibraryAsset[] = [
  {
    name: 'CGeneral',
    catalog: catalog.CGeneral,
    load: () => import('@/features/element-library/data/CGeneral').then((module) => module.default),
    sources: sources('CGeneral'),
  },
  {
    name: 'GRUNDFOS',
    catalog: catalog.GRUNDFOS,
    load: () => import('@/features/element-library/data/GRUNDFOS').then((module) => module.default),
    sources: sources('GRUNDFOS'),
  },
  {
    name: 'BELIMO',
    catalog: catalog.BELIMO,
    load: () => import('@/features/element-library/data/BELIMO').then((module) => module.default),
    sources: sources('BELIMO', 'CBELIMO'),
  },
];

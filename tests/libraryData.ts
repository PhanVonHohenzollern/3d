import { libraries } from '@/features/element-library/config/libraries';
export const CGeneral = await libraries.find((library) => library.name === 'CGeneral')!.load();
export const GRUNDFOS = await libraries.find((library) => library.name === 'GRUNDFOS')!.load();
export const BELIMO = await libraries.find((library) => library.name === 'BELIMO')!.load();

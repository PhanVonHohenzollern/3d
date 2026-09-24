import type { ApiSignatureMetadata } from './ApiMetadata';

const signature = (name: string, sourceHeader: string, parameters: [string, string][]): ApiSignatureMetadata => ({
  name,
  sourceHeader,
  returnType: 'void',
  requiredParameterCount: parameters.length,
  parameters: parameters.map(([name, type]) => ({ name, type, defaultValue: '' })),
});

export const additionalApiSignatures: readonly ApiSignatureMetadata[] = [
  signature('makeSimpleBowl', 'BowlPrimitivesInt.h', [['bowl', 'const FdBowlInfo &']]),
  signature('makeBowlSubstraction', 'BowlPrimitivesInt.h', [
    ['bowlO', 'const FdBowlInfo &'],
    ['bowlI', 'const FdBowlInfo &'],
  ]),
  signature('makeVascoVascoPlenum3', 'VascoPrimitivesInt.h', [
    ['start', 'const FdPoint3d &'],
    ['normal', 'const FdVector3d &'],
    ['upVector', 'const FdVector3d &'],
    ['boxSize', 'double'],
    ['radius', 'double'],
    ['connWidth', 'double[3]'],
    ['connHeight', 'double[3]'],
    ['connLength', 'double[3]'],
    ['height', 'double[2]'],
    ['connDiameter', 'double[2]'],
    ['connOffsets', 'double[2]'],
    ['n', 'int'],
    ['nR', 'int'],
  ]),
];

import fs from 'node:fs';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const kLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']; // highest first
const kSlicedLayers = ['pages', 'widgets', 'features', 'entities'];

const directories = (path) =>
  fs.existsSync(path)
    ? fs
        .readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

const entries = (path) => (fs.existsSync(path) ? fs.readdirSync(path) : []);

const slices = (layer) => directories(`src/${layer}`).map((slice) => ({ layer, slice }));

const allSlices = kSlicedLayers.flatMap(slices);

const layerDirection = kLayers.slice(1).map((layer, index) => ({
  target: `./src/${layer}`,
  from: kLayers.slice(0, index + 1).map((higher) => `./src/${higher}`),
  message: `${layer}/ may only import from layers below it (see docs/architecture.md).`,
}));

const noCrossSliceImports = allSlices.map(({ layer, slice }) => ({
  target: `./src/${layer}/${slice}`,
  from: `./src/${layer}`,
  except: [`./${slice}`],
  message: `${layer}/${slice} may not import another ${layer} slice; compose them one layer up.`,
}));

const everythingOutside = (layer, slice) => [
  ...entries('src')
    .filter((top) => top !== layer)
    .map((top) => `./src/${top}`),
  ...slices(layer)
    .filter((other) => other.slice !== slice)
    .map((other) => `./src/${layer}/${other.slice}`),
];

const slicePublicApi = allSlices.map(({ layer, slice }) => ({
  target: everythingOutside(layer, slice),
  from: `./src/${layer}/${slice}`,
  except: ['./index.ts'],
  message: `Import ${layer}/${slice} through its index.ts only.`,
}));

const engineRules = [
  {
    target: './engine/geometry/adapters/!(apiAdapters).ts',
    from: './engine/geometry/adapters/!(types).ts',
    message: 'An adapter must not import another adapter; move shared code to geometry/builders or geometry/helpers.',
  },
];

const zones = [...layerDirection, ...noCrossSliceImports, ...slicePublicApi, ...engineRules];

export default defineConfig([
  globalIgnores(['dist', 'engine/runtime/*.generated.ts']),
  {
    files: ['src/**/*.{ts,tsx}', 'engine/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/extensions': ['.ts', '.tsx', '.js'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      'import-x/no-restricted-paths': ['error', { zones }],
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
    },
  },
]);

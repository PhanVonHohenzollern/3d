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

const legacyFolders = [
  {
    target: './src/entities',
    from: ['./src/components', './src/hooks', './src/helpers', './src/types', './src/core', './src/utils'],
    message: 'entities/ must not import app code (components, hooks, helpers, types, core, utils).',
  },
  {
    target: './src/shared',
    from: ['./src/components', './src/hooks', './src/helpers', './src/types', './src/core', './src/lib'],
    message: 'shared/ must not import app code (components, hooks, helpers, types, core).',
  },
  {
    target: './src/utils',
    from: ['./src/components', './src/hooks', './src/helpers', './src/core'],
    message: 'utils/ must stay generic: no app or engine imports.',
  },
  {
    target: './src/types',
    from: ['./src/components', './src/hooks'],
    message: 'types/ must not import hooks or components; move the type next to the code that owns it.',
  },
  {
    target: './src/core/viewport',
    from: ['./src/components', './src/hooks', './src/helpers'],
    message: 'The viewport must not depend on app helpers, hooks or components.',
  },
];

const zones = [...layerDirection, ...noCrossSliceImports, ...slicePublicApi, ...legacyFolders];

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
      'import-x/no-restricted-paths': ['warn', { zones }],
      'import-x/no-cycle': ['warn', { ignoreExternal: true }],
    },
  },
]);

import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Import direction checks for the move to Feature-Sliced Design (docs/architecture.md).
// Run with `npm run lint:boundaries`. They only warn while the migration is in progress and are
// kept out of eslint.config.js so `npm run lint` stays at zero warnings. GPW-38 makes them errors.

const engine = ['./src/core/runtime', './src/core/geometry', './src/core/formats'];
const engineOnlyUtils = ['./cpp.ts', './cppStd.ts', './DVec3.ts', './dmat4.ts'];
const appFolders = ['./src/components', './src/hooks', './src/helpers', './src/types', './src/lib'];

const zones = [
  ...engine.map((target) => ({
    target,
    from: [...appFolders, './src/core/viewport'],
    message: 'The engine (runtime, geometry, formats) must not import app code.',
  })),
  ...engine.map((target) => ({
    target,
    from: './src/utils',
    except: engineOnlyUtils,
    message: 'The engine may only use the utils that move into engine/ with it (cpp, cppStd, DVec3, dmat4).',
  })),
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

export default defineConfig([
  globalIgnores(['dist', 'src/core/runtime/*.generated.ts']),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'import-x': importX },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver()] },
    rules: { 'import-x/no-restricted-paths': ['warn', { zones }] },
  },
]);

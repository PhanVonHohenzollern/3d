import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const functionDeclaration =
  ':matches(FunctionDeclaration, VariableDeclaration:has(> VariableDeclarator[init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]))';
const functionStatement = {
  selector: `${functionDeclaration}, :matches(ExportNamedDeclaration, ExportDefaultDeclaration):has(> ${functionDeclaration})`,
};
const overloadStatement = {
  selector: 'TSDeclareFunction, ExportNamedDeclaration[declaration.type="TSDeclareFunction"]',
};

const relativeImports = {
  regex: '^(\\.{1,2}(/|$)|~/|src/|tests/|engine/|/)',
  message:
    'Import project code with @/ (src), @engine/ (engine) or @tests/ (tests), never a relative or absolute path (docs/architecture.md).',
};

export default defineConfig([
  globalIgnores(['dist', 'engine/runtime/*.generated.ts']),
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { patterns: [relativeImports] }],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: functionStatement },
        { blankLine: 'always', prev: functionStatement, next: '*' },
        { blankLine: 'any', prev: overloadStatement, next: [overloadStatement, functionStatement] },
      ],
      '@stylistic/lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'always', prev: 'method', next: '*' },
          ],
        },
        { exceptAfterOverload: true },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            relativeImports,
            {
              regex: '^@engine/[^/]+/.+',
              message:
                'Import the engine through its package: @engine/runtime, @engine/geometry, @engine/formats or @engine/math.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            relativeImports,
            { regex: '^@(tests)?/', message: 'The engine must not import app or test code.' },
          ],
        },
      ],
    },
  },
]);

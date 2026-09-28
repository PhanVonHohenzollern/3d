import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

// Feature-Sliced Design checks for src/ (docs/architecture.md). Every rule only warns while the
// app is being moved into layers; GPW-38 switches them back to errors.
const recommended = fsd.configs.recommended.find((config) => config.rules)?.rules ?? {};
const warnings = Object.fromEntries(Object.keys(recommended).map((rule) => [rule, 'warn']));

export default defineConfig([...fsd.configs.recommended, { rules: warnings }]);

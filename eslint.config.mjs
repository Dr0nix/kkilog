import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/.next/',
    '**/.expo/',
    'apps/mobile/android/',
    'apps/mobile/ios/',
    '**/next-env.d.ts',
    '**/expo-env.d.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
);

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// Legacy config bridge - eslint-config-next 15 ships eslintrc presets.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Lint rules - Next core web vitals + TypeScript presets, ignoring build output.
const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'] },
];

export default eslintConfig;

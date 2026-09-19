import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/*.tsbuildinfo',
      'next-env.d.ts',
      'public/designsystem/**',
      // Reference code from another project, never imported or built.
      'stealth-ref/**',
      'local/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  ...[...nextCoreWebVitals, ...nextTypescript].map(config => ({
    ...config,
    files: ['src/**/*.{ts,tsx}'],
  })),

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'off',
    },
  },

  {
    files: ['src/**/*.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        require: 'readonly',
      },
    },
  },

  // Must stay last: switches off every rule that would fight Prettier's formatting.
  prettier,
);

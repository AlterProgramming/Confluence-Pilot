import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const reactRules = reactHooks.configs.flat['recommended-latest'] ?? reactHooks.configs.flat.recommended;

export default [
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'public/**', 'validation/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: 'module',
        ecmaVersion: 'latest',
        babelOptions: {
          presets: [
            ['@babel/preset-react', { runtime: 'automatic' }],
            ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
          ],
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactRules.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unknown-property': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: [
      'src/materials/usePbr.ts',
      'src/components/CameraDirector.tsx',
      'src/components/GlobalParticles.tsx',
      'src/components/LifeMotes.tsx',
      'src/components/RoomAsset.tsx',
      'src/scenes/kit/LedWall.tsx',
    ],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
];

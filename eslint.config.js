import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'error',
      // TypeScript resolves globals; the ESLint rule only knows its own env list
      // and would reject every DOM type.
      'no-undef': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      // Optional props are optional on purpose — the composable falls back
      // internally rather than pretending a default exists.
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': ['warn', { singleline: 4 }],
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.mjs'],
    rules: {
      // Scripts are run by hand and report by printing.
      'no-console': 'off',
      // Test hosts are defined inline, next to the behaviour they set up.
      'vue/one-component-per-file': 'off',
    },
  },
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      'playground/dist/',
    ],
  },
)

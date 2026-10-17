import js from '@eslint/js';
import globals from 'globals';

const noUnsafeHtml = [
  { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]", message: 'Write data with textContent or cloned templates (docs/02-trd.md section 8).' },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'Write data with textContent or cloned templates (docs/02-trd.md section 8).' },
];

export default [
  { ignores: ['node_modules/', 'public/vendor/', 'coverage/', '.vercel/'] },
  js.configs.recommended,
  {
    rules: {
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['server/**/*.js', 'api/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-restricted-syntax': ['error', ...noUnsafeHtml] },
  },
  {
    // Classic script loaded in <head> before modules run.
    files: ['public/js/theme-init.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-var': 'off' },
  },
];

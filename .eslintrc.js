module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  env: {
    node: true,
    'jest/globals': true,
  },
  plugins: ['@typescript-eslint', 'jest', 'prettier'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'no-unused-expressions': [
      'warn',
      {
        allowShortCircuit: true,
        allowTernary: true,
      },
    ],
    '@typescript-eslint/explicit-function-return-type': [
      'off',
      {
        allowExpressions: false,
        allowTypedFunctionExpressions: false,
      },
    ],
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
  },
}

module.exports = {
  root: true,
  extends: [
    '@react-native-community/eslint-config',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'prettier'],
  rules: {
    'prettier/prettier': [
      'error',
      {
        arrowParens: 'avoid',
        bracketSameLine: true,
        bracketSpacing: false,
        singleQuote: true,
        trailingComma: 'all',
      },
    ],
    'react/prop-types': 'off',

    'no-dupe-keys': 'error',
    'react/no-unused-prop-types': 'warn',
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-use-before-define': 'off',
    'react-native/no-inline-styles': 'off',
    // "@typescript-eslint/no-use-before-define": ["error"],
    // Add this rule to allow ES module imports in the server file
    '@typescript-eslint/no-var-requires': 'off',
    // Inflates every size ~2x on iPad. Use @/utils/scale (ipad-standards §3).
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native-size-matters',
            message:
              "Import from '@/utils/scale' instead. It matches the library on phones and stops tablets inflating.",
          },
          {
            name: 'react-native-actions-sheet',
            importNames: ['default'],
            message:
              "Import ActionSheet from '@/components/sheets/AdaptiveActionSheet' so sheets stop at 560pt on iPad (ipad-standards §5.3).",
          },
        ],
      },
    ],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};

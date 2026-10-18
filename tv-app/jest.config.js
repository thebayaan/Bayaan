const path = require('path');

// jest-expo's setup requires expo-modules-core, which npm nests under
// expo/node_modules instead of hoisting it, so point the components project
// at expo's own copy.
const expoModulesCore = path.dirname(
  require.resolve('expo-modules-core/package.json', {
    paths: [path.dirname(require.resolve('expo/package.json'))],
  }),
);

module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/services/**/*.test.ts',
        '<rootDir>/store/**/*.test.ts',
        '<rootDir>/hooks/**/*.test.ts',
        '<rootDir>/theme/surahColors.test.ts',
      ],
      setupFiles: ['<rootDir>/__tests__/setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json'}],
      },
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/components/**/*.test.tsx',
        '<rootDir>/hooks/**/*.test.tsx',
        '<rootDir>/theme/**/*.test.ts',
      ],
      // Pure-logic theme tests run in the unit project above.
      testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/theme/surahColors.test.ts',
      ],
      setupFiles: ['<rootDir>/__tests__/setup.ts'],
      moduleNameMapper: {
        '^expo-modules-core$': expoModulesCore,
        '^expo-modules-core/(.*)$': `${expoModulesCore}/$1`,
      },
      transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-native-tvos)',
      ],
    },
  ],
};

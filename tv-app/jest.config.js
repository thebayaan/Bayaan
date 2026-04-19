module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-native-tvos)',
  ],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/services/**/*.test.ts'],
      setupFiles: ['<rootDir>/__tests__/setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json'}],
      },
    },
  ],
};

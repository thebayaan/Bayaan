module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/services/**/*.test.ts',
        '<rootDir>/store/**/*.test.ts',
        '<rootDir>/hooks/**/*.test.ts',
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
      ],
      setupFiles: ['<rootDir>/__tests__/setup.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-native-tvos)',
      ],
    },
  ],
};

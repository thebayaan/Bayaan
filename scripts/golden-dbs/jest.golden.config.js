// Runs populate.golden.ts against the RELEASE source (GOLDEN_RELEASE_ROOT)
// while using this tree's sqlite adapter. jest-expo is not used: the release
// database services only need TypeScript transpilation, so babel-jest with
// this repo's babel-preset-expo is enough and avoids installing the release.
const path = require('path');
const release = process.env.GOLDEN_RELEASE_ROOT;
const root = path.resolve(__dirname, '../..');
module.exports = {
  rootDir: release,
  roots: [path.join(root, 'scripts/golden-dbs')],
  testMatch: ['**/populate.golden.ts'],
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', path.join(root, 'node_modules')],
  transform: {
    '\\.[jt]sx?$': [
      require.resolve('babel-jest', {paths: [root]}),
      {
        configFile: false,
        babelrc: false,
        presets: [require.resolve('babel-preset-expo', {paths: [root]})],
      },
    ],
  },
  moduleNameMapper: {
    '^expo-sqlite$': path.join(root, 'test-utils/mockExpoSqlite.ts'),
    '^@/test-utils/(.*)$': path.join(root, 'test-utils/$1'),
    '^@/(.*)$': path.join(release, '$1'),
  },
};

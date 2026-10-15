// Jest automatically uses node-module mocks placed under a root-level __mocks__
// directory. This lets test files import modules that transitively pull in
// AsyncStorage (e.g. persisted zustand stores like analyticsConsentStore /
// devSettingsStore) without the "[@RNC/AsyncStorage]: NativeModule:
// AsyncStorage is null" error. Re-exports the package's official jest mock.
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');

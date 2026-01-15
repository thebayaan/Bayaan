const {getDefaultConfig} = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const path = require('path');

const projectRoot = __dirname;
const sharedPackageRoot = path.resolve(
  projectRoot,
  '..',
  'expo-audio-share-receiver',
);

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve the local linked package outside the app root,
// but keep dependencies resolved from the app's node_modules.
config.watchFolders = [sharedPackageRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.blacklistRE = exclusionList([
  new RegExp(`${sharedPackageRoot}/node_modules/.*`),
]);

module.exports = config;


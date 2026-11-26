const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
  },
});

// Allow .db files to be bundled as assets
config.resolver.assetExts = config.resolver.assetExts ?? [];
config.resolver.assetExts.push('db');

// @tilawa/core only declares an "import" export condition, which Metro skips
// once Babel has turned imports into require() calls. Point it at the entry.
// @tilawa/core-v1 is the same package at 1.0.0-rc.1 (the preview engine), with
// the same exports, so its entries are pointed at in the same way.
const tilawaEntries = {
  '@tilawa/core': 'node_modules/@tilawa/core/dist/index.js',
  '@tilawa/core-v1': 'node_modules/@tilawa/core-v1/dist/index.js',
  '@tilawa/core-v1/react-native':
    'node_modules/@tilawa/core-v1/dist/react-native.js',
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const tilawaEntry = tilawaEntries[moduleName];
  if (tilawaEntry) {
    return {type: 'sourceFile', filePath: path.join(__dirname, tilawaEntry)};
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

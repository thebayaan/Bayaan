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
const tilawaEntry = path.join(
  __dirname,
  'node_modules/@tilawa/core/dist/index.js',
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tilawa/core') {
    return {type: 'sourceFile', filePath: tilawaEntry};
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

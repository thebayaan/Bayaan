const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
  },
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Allow .db files to be bundled as assets (for timestamps.db)
config.resolver.assetExts = config.resolver.assetExts ?? [];
config.resolver.assetExts.push('db');

module.exports = config;

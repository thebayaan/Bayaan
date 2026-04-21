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

module.exports = config;

const {withAndroidManifest} = require('@expo/config-plugins');

const withLargeHeap = config => {
  return withAndroidManifest(config, async config => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication?.$) {
      mainApplication.$['android:largeHeap'] = 'true';
    }
    return config;
  });
};

module.exports = withLargeHeap;

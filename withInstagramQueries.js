const {withAndroidManifest} = require('@expo/config-plugins');

const INSTAGRAM_PACKAGE = 'com.instagram.android';

const withInstagramQueries = config => {
  return withAndroidManifest(config, async config => {
    const manifest = config.modResults.manifest;

    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [];
    }

    // Find an existing <queries> block we can append to (if any).
    let queriesBlock = manifest.queries[0];
    if (!queriesBlock) {
      queriesBlock = {};
      manifest.queries.push(queriesBlock);
    }

    if (!Array.isArray(queriesBlock.package)) {
      queriesBlock.package = [];
    }

    const alreadyDeclared = queriesBlock.package.some(
      entry => entry?.$?.['android:name'] === INSTAGRAM_PACKAGE,
    );

    if (!alreadyDeclared) {
      queriesBlock.package.push({
        $: {'android:name': INSTAGRAM_PACKAGE},
      });
    }

    return config;
  });
};

module.exports = withInstagramQueries;

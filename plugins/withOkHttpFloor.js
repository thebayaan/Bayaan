// @ai-generated
const {
  withAppBuildGradle,
  createRunOncePlugin,
} = require('expo/config-plugins');

/**
 * Raises OkHttp to at least 4.12.1, which refuses the compromised eMudhra
 * intermediate CAs (October 2026) before any request is sent. React Native
 * and several Expo modules still ask for 4.9.2, and Gradle picks the highest
 * version anyone asks for, so constraints on the app module lift every
 * module's OkHttp. Devices with current Play Services already block these
 * CAs; this covers the ones without, such as Fire OS and sideloads.
 */

const START_MARKER = '// @bayaan-okhttp start';
const END_MARKER = '// @bayaan-okhttp end';

// The app module's dependencies block. The constraints open it, so their
// place doesn't depend on what other plugins add to it.
const ANCHOR = '\ndependencies {\n';

const BLOCK = `    ${START_MARKER}
    // OkHttp 4.12.1 refuses the compromised eMudhra intermediate CAs.
    // React Native and Expo modules ask for 4.9.2, so raise the floor here.
    constraints {
        implementation("com.squareup.okhttp3:okhttp:4.12.1")
        implementation("com.squareup.okhttp3:okhttp-urlconnection:4.12.1")
    }
    ${END_MARKER}

`;

function addOkHttpFloor(src) {
  if (src.includes(START_MARKER)) return src;
  if (!src.includes(ANCHOR)) {
    throw new Error(
      '[withOkHttpFloor] app/build.gradle "dependencies {" not found. Update ANCHOR for this Expo SDK.',
    );
  }
  return src.replace(ANCHOR, ANCHOR + BLOCK);
}

function withOkHttpFloor(config) {
  return withAppBuildGradle(config, cfg => {
    cfg.modResults.contents = addOkHttpFloor(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withOkHttpFloor,
  'withOkHttpFloor',
  '1.0.0',
);
module.exports.addOkHttpFloor = addOkHttpFloor;

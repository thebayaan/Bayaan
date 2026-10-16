// targets/widgets/expo-target.config.js
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  name: 'BayaanWidgetsExtension',
  displayName: config.name,
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'ActivityKit'],
  colors: {
    $widgetBackground: {light: '#FFFFFF', dark: '#111111'},
    $accent: {light: '#111111', dark: '#FFFFFF'},
  },
  entitlements: {
    // The main app's App Group entitlement is written by the
    // expo-share-intent plugin (not config.ios.entitlements), so derive the
    // same `group.<bundle id>` value here.
    'com.apple.security.application-groups': [
      `group.${config.ios.bundleIdentifier}`,
    ],
  },
});

const {
  withInfoPlist,
  withEntitlementsPlist,
  withAppDelegate,
  createRunOncePlugin,
} = require('expo/config-plugins');

const START_MARKER = '// @bayaan-car scene bridge start';
const SIRI_START_MARKER = '// @bayaan-car siri start';
const SIRI_END_MARKER = '// @bayaan-car siri end';
const SIRI_ANCHOR = '  // Linking API\n';

const SIRI_BLOCK = `  ${SIRI_START_MARKER}
  func application(_ application: UIApplication, handlerFor intent: INIntent) -> Any? {
    return BayaanCarSiri.handler(for: intent)
  }

  func application(
    _ application: UIApplication,
    handle intent: INIntent,
    completionHandler: @escaping (INIntentResponse) -> Void
  ) {
    BayaanCarSiri.handle(intent, completion: completionHandler)
  }
  ${SIRI_END_MARKER}

`;
const END_MARKER = '// @bayaan-car scene bridge end';

const ORIGINAL_WINDOW_BLOCK = `    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)`;

const BRIDGE_BLOCK = `    ${START_MARKER}
    BayaanCarSceneBridge.shared.configure(
      start: { hostWindow, extra in
        let merged = (launchOptions ?? [:]).merging(extra) { _, new in new }
        factory.startReactNative(withModuleName: "main", in: hostWindow, launchOptions: merged)
      },
      onWindow: { [weak self] hostWindow in self?.window = hostWindow })
    ${END_MARKER}`;

function withCarPlayInfoPlist(config) {
  return withInfoPlist(config, cfg => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Phone',
            UISceneDelegateClassName: 'PhoneSceneDelegate',
          },
        ],
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'CarPlay',
            UISceneDelegateClassName: 'CarPlaySceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

// Siri "play ... on Bayaan", handled in the app (no Intents extension).
function withSiriInfoPlist(config) {
  return withInfoPlist(config, cfg => {
    const supported = new Set(cfg.modResults.INIntentsSupported ?? []);
    supported.add('INPlayMediaIntent');
    cfg.modResults.INIntentsSupported = [...supported];
    cfg.modResults.INSupportedMediaCategories = ['INMediaCategoryGeneral'];
    return cfg;
  });
}

function withSiriEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    cfg.modResults['com.apple.developer.siri'] = true;
    return cfg;
  });
}

function withSiriAppDelegate(config) {
  return withAppDelegate(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes(SIRI_START_MARKER)) return cfg;
    if (!src.includes(SIRI_ANCHOR)) {
      throw new Error(
        '[withBayaanCar] AppDelegate "// Linking API" anchor not found. Update SIRI_ANCHOR for this Expo SDK.',
      );
    }
    src = src.replace(SIRI_ANCHOR, SIRI_BLOCK + SIRI_ANCHOR);
    if (!src.includes('import Intents')) {
      src = src.replace('import React\n', 'import React\nimport Intents\n');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withCarPlayEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    cfg.modResults['com.apple.developer.carplay-audio'] = true;
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes(START_MARKER)) return cfg;
    if (!src.includes(ORIGINAL_WINDOW_BLOCK)) {
      throw new Error(
        '[withBayaanCar] AppDelegate window block not found. Update ORIGINAL_WINDOW_BLOCK for this Expo SDK.',
      );
    }
    src = src.replace(ORIGINAL_WINDOW_BLOCK, BRIDGE_BLOCK);
    if (!src.includes('import BayaanCar')) {
      if (!src.includes('import React\n')) {
        throw new Error(
          '[withBayaanCar] AppDelegate "import React" anchor not found. Update the import anchor for this Expo SDK.',
        );
      }
      src = src.replace(
        'import React\n',
        'import React\ninternal import BayaanCar\n',
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

// Forks without Apple's CarPlay audio entitlement can pass {carPlayAudioEntitlement: false};
// forks without the Siri capability on their App ID can pass {siri: false}.
function withBayaanCar(config, props) {
  const {carPlayAudioEntitlement = true, siri = true} = props ?? {};
  config = withCarPlayInfoPlist(config);
  if (carPlayAudioEntitlement) config = withCarPlayEntitlement(config);
  config = withSceneAppDelegate(config);
  if (siri) {
    config = withSiriInfoPlist(config);
    config = withSiriEntitlement(config);
    config = withSiriAppDelegate(config);
  }
  return config;
}

module.exports = createRunOncePlugin(withBayaanCar, 'withBayaanCar', '1.0.0');

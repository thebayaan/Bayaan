const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withInfoPlist,
  withEntitlementsPlist,
  withAppDelegate,
  withDangerousMod,
  createRunOncePlugin,
} = require('expo/config-plugins');

const SCENE_DELEGATE = path.join(
  __dirname,
  'bayaan-car',
  'SceneDelegate.swift',
);

const START_MARKER = '// @bayaan-car scene bridge start';
const END_MARKER = '// @bayaan-car scene bridge end';
const SIRI_START_MARKER = '// @bayaan-car siri start';
const SIRI_END_MARKER = '// @bayaan-car siri end';

// SDK 58 template: AppDelegate builds the React Native factory and leaves the
// window to the scene delegate. The bridge block goes right before the
// `super` call, and the Siri methods at the end of the AppDelegate class.
const BRIDGE_ANCHOR =
  '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n';
const SIRI_ANCHOR = '}\n\nclass ReactNativeDelegate';

const BRIDGE_BLOCK = `    ${START_MARKER}
    // SceneDelegate (the phone) and CarPlaySceneDelegate start React Native
    // through the bridge, whichever scene connects first.
    BayaanCarSceneBridge.shared.configure(
      start: { hostWindow, extra in
        let merged = (launchOptions ?? [:]).merging(extra) { _, new in new }
        factory.startReactNative(withModuleName: "main", in: hostWindow, launchOptions: merged)
      },
      onWindow: { [weak self] hostWindow in self?.window = hostWindow })
    ${END_MARKER}

`;

const SIRI_BLOCK = `
  ${SIRI_START_MARKER}
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

function addImport(src, line) {
  if (src.includes(`${line}\n`)) return src;
  if (!src.includes('import React\n')) {
    throw new Error(
      '[withBayaanCar] AppDelegate "import React" anchor not found. Update the import anchor for this Expo SDK.',
    );
  }
  return src.replace('import React\n', `import React\n${line}\n`);
}

/** Adds the scene bridge to an SDK 58 AppDelegate. Idempotent. */
function applySceneAppDelegate(src) {
  if (src.includes(START_MARKER)) return src;
  if (!src.includes(BRIDGE_ANCHOR)) {
    throw new Error(
      '[withBayaanCar] AppDelegate didFinishLaunching super call not found. Update BRIDGE_ANCHOR for this Expo SDK.',
    );
  }
  src = src.replace(BRIDGE_ANCHOR, BRIDGE_BLOCK + BRIDGE_ANCHOR);
  return addImport(src, 'internal import BayaanCar');
}

/** Adds the in-app Siri intent handling to an SDK 58 AppDelegate. Idempotent. */
function applySiriAppDelegate(src) {
  if (src.includes(SIRI_START_MARKER)) return src;
  if (!src.includes(SIRI_ANCHOR)) {
    throw new Error(
      '[withBayaanCar] end of the AppDelegate class not found. Update SIRI_ANCHOR for this Expo SDK.',
    );
  }
  src = src.replace(SIRI_ANCHOR, SIRI_BLOCK + SIRI_ANCHOR);
  return addImport(src, 'import Intents');
}

// Adds a CarPlay scene next to the SDK 58 template's phone scene. Either can
// start React Native first, so the template's SceneDelegate.swift is replaced
// with ours (withPhoneSceneDelegate).
function withCarPlayInfoPlist(config) {
  return withInfoPlist(config, cfg => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Phone',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
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
    cfg.modResults.contents = applySiriAppDelegate(cfg.modResults.contents);
    return cfg;
  });
}

function withCarPlayEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    cfg.modResults['com.apple.developer.carplay-audio'] = true;
    return cfg;
  });
}

// The template already adds SceneDelegate.swift to the app target; only its
// contents change.
function withPhoneSceneDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    async cfg => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(
        cfg.modRequest.projectRoot,
      );
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        'SceneDelegate.swift',
      );
      if (!fs.existsSync(dest)) {
        throw new Error(
          '[withBayaanCar] SceneDelegate.swift not found in the iOS project. This plugin expects the Expo SDK 58+ template.',
        );
      }
      fs.copyFileSync(SCENE_DELEGATE, dest);
      return cfg;
    },
  ]);
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, cfg => {
    cfg.modResults.contents = applySceneAppDelegate(cfg.modResults.contents);
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
  config = withPhoneSceneDelegate(config);
  if (siri) {
    config = withSiriInfoPlist(config);
    config = withSiriEntitlement(config);
    config = withSiriAppDelegate(config);
  }
  return config;
}

module.exports = createRunOncePlugin(withBayaanCar, 'withBayaanCar', '1.0.0');
module.exports.applySceneAppDelegate = applySceneAppDelegate;
module.exports.applySiriAppDelegate = applySiriAppDelegate;

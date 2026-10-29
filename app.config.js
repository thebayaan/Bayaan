// Import version information from Git-based generator
const versionInfo = require('./scripts/generate-version');

// Get version string
const getVersionString = () => versionInfo.semanticVersion;

// ─── Fork-configurable identifiers ───────────────────────────────────────────
// Defaults are the maintainer's values so local builds work with no extra
// setup. Forks override via environment variables documented in .env.example.
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? 'S4W5Q2L53W';
const EAS_PROJECT_ID_FROM_ENV = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const EAS_PROJECT_ID =
  EAS_PROJECT_ID_FROM_ENV ?? 'e31ace41-2d1b-4777-8230-8c8264277d59';
// Only enable Expo OTA updates when the EAS project ID is explicitly set via
// env. Forks that don't set it get no update checks (no phone-home to the
// maintainer's Expo project).
const OTA_UPDATES_ENABLED = Boolean(EAS_PROJECT_ID_FROM_ENV);
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'com.bayaan.app';
// Associated/deep-link domain. Forks must set their own; leaving unset means
// no universal-link registration, avoiding conflicts with the maintainer's app.
const ASSOCIATED_DOMAIN = process.env.EXPO_PUBLIC_ASSOCIATED_DOMAIN;
const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://thebayaan.com/privacy';

// @ai-start
module.exports = {
  expo: {
    name: 'Bayaan',
    slug: 'Bayaan',
    scheme: 'bayaan',
    version: getVersionString(),
    orientation: 'portrait',
    cli: {
      appVersionSource: 'remote',
      version: '>= 5.9.1',
    },
    ios: {
      bundleIdentifier: IOS_BUNDLE_ID,
      buildNumber: versionInfo.buildNumber,
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false,
      },
      teamId: APPLE_TEAM_ID,
      appleTeamId: APPLE_TEAM_ID,
      ...(ASSOCIATED_DOMAIN
        ? {associatedDomains: [`applinks:${ASSOCIATED_DOMAIN}`]}
        : {}),
      infoPlist: {
        BayaanAppGroup: `group.${IOS_BUNDLE_ID}`,
        NSSupportsLiveActivities: true,
        NSMicrophoneUsageDescription:
          'Bayaan uses the microphone to follow along as you recite. Audio stays on your device.',
        NSAppleMusicUsageDescription:
          'This app uses Apple Music to play audio.',
        UILaunchStoryboardName: 'SplashScreen',
        LSRequiresIPhoneOS: true,
        // Show Settings › Apps › Bayaan › Language even when the device has a
        // single preferred language. The language screen sends users there.
        UIPrefersShowingLanguageSettings: true,
        // Matches ios/Bayaan/Info.plist: iPad multitasking (Split View, Stage
        // Manager) is on, so iPad windows can be any size. @ai
        UIRequiresFullScreen: false,
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'This app does not use the camera.',
        BGTaskSchedulerPermittedIdentifiers: ['com.bayaan.app.audio'],
        UIBackgroundModes: ['audio', 'remote-notification'],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['bayaan'],
          },
        ],
        NSPrivacyPolicyURL: PRIVACY_POLICY_URL,
        UISupportedInterfaceOrientations: [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
        'UISupportedInterfaceOrientations~ipad': [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationPortraitUpsideDown',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
      },
      icon: {
        dark: './assets/images/ios-dark.png',
        light: './assets/images/ios-light.png',
        tinted: './assets/images/ios-tinted.png',
      },
    },
    fonts: [
      'assets/fonts/Manrope-Regular.ttf',
      'assets/fonts/Manrope-Bold.ttf',
      'assets/fonts/Manrope-Medium.ttf',
      'assets/fonts/Manrope-SemiBold.ttf',
      'assets/fonts/Manrope-Light.ttf',
      'assets/fonts/Manrope-ExtraLight.ttf',
      'assets/fonts/Manrope-ExtraBold.ttf',
      'assets/fonts/surah_names.ttf',
      'assets/fonts/surah_names_2.ttf',
      'assets/fonts/ScheherazadeNew-Regular.ttf',
      'assets/fonts/ScheherazadeNew-Medium.ttf',
      'assets/fonts/ScheherazadeNew-Bold.ttf',
      'assets/fonts/ScheherazadeNew-SemiBold.ttf',
    ],
    extra: {
      // Add your environment variables here
      eas: {
        projectId: EAS_PROJECT_ID,
      },
      isDevelopmentMode: false,
      // Add version information for runtime access
      version: {
        semanticVersion: versionInfo.semanticVersion,
        buildNumber: versionInfo.buildNumber,
        gitHash: versionInfo.gitHash,
        gitBranch: versionInfo.gitBranch,
        buildTime: versionInfo.buildTime,
        fullVersion: versionInfo.fullVersion,
      },
    },
    android: {
      package: 'com.bayaan.app',
      versionCode: versionInfo.versionCode,
      userInterfaceStyle: 'automatic',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#8dc9d6',
      },
      screenOrientation: 'portrait',
      ...(ASSOCIATED_DOMAIN
        ? {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                data: [
                  {
                    scheme: 'https',
                    host: ASSOCIATED_DOMAIN,
                    pathPrefix: '/quran',
                  },
                  {
                    scheme: 'https',
                    host: ASSOCIATED_DOMAIN,
                    pathPrefix: '/reciter',
                  },
                  {
                    scheme: 'https',
                    host: ASSOCIATED_DOMAIN,
                    pathPrefix: '/mushaf',
                  },
                  {
                    scheme: 'https',
                    host: ASSOCIATED_DOMAIN,
                    pathPrefix: '/adhkar',
                  },
                ],
                category: ['BROWSABLE', 'DEFAULT'],
              },
            ],
          }
        : {}),
    },
    experiments: {
      reactCompiler: true,
    },
    updates: OTA_UPDATES_ENABLED
      ? {
          enabled: true,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 2000,
          url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
        }
      : {enabled: false},
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          // SDK 58 turns R8 on for release builds. Keep it off until a
          // minified release (Android Auto, widgets, MMKV/Nitro, Sentry) has
          // been tested and any keep rules are in android/app/proguard-rules.pro.
          android: {enableMinifyInReleaseBuilds: false},
        },
      ],
      [
        'expo-localization',
        // Direction is controlled by the in-app language preference. Static
        // supportsRTL/forcesRTL resets I18nManager to the device locale on iOS.
        {supportedLocales: {ios: ['en', 'ar']}},
      ],
      '@bacons/apple-targets',
      ['expo-audio', {enableBackgroundPlayback: true}],
      'expo-sqlite',
      'expo-asset',
      'expo-font',
      'expo-image',
      'expo-sharing',
      'expo-status-bar',
      'expo-web-browser',
      [
        'react-native-audio-api',
        {
          iosBackgroundMode: false,
          androidForegroundService: false,
          androidPermissions: ['android.permission.RECORD_AUDIO'],
          disableFFmpeg: true,
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'native',
          backgroundColor: '#ffffff',
          imageResizeMode: 'native',
          imageWidth: 500,
          dark: {
            image: './assets/images/splash-icon-dark.png',
            backgroundColor: '#000000',
          },
          android: {
            image: './assets/images/splash-icon.png',
            dark: {
              image: './assets/images/splash-icon-dark.png',
            },
          },
          userInterfaceStyle: 'automatic',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/notification_icon.png',
          color: '#ffffff',
          sounds: [],
        },
      ],
      [
        'expo-share-intent',
        {
          iosActivationRules: {
            NSExtensionActivationSupportsFileWithMaxCount: 10,
          },
          androidIntentFilters: ['audio/*'],
          androidMultiIntentFilters: ['audio/*'],
        },
      ],
      // Only wire up the Sentry Expo plugin (adds the source-map + debug-symbol
      // upload build phases) when a DSN is configured. Forks/contributors
      // without Sentry credentials can build and archive without running the
      // upload scripts.
      ...(process.env.EXPO_PUBLIC_SENTRY_DSN
        ? [
            [
              '@sentry/react-native/expo',
              {
                organization: process.env.SENTRY_ORG ?? 'bayaan',
                project: process.env.SENTRY_PROJECT ?? 'bayaan',
              },
            ],
          ]
        : []),
      './withAndroidSigning.js',
      './withLargeHeap.js',
      './withIOSTeam.js',
      './plugins/withBayaanCar.js',
      './plugins/withAppShortcuts.js',
      './plugins/withBayaanWidgets.js',
      './plugins/withBayaanKeyboard.js',
      './plugins/withOkHttpFloor.js',
    ],
  },
};
// @ai-end

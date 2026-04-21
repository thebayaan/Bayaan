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
// Associated/deep-link domain. Forks must set their own; leaving unset means
// no universal-link registration, avoiding conflicts with the maintainer's app.
const ASSOCIATED_DOMAIN = process.env.EXPO_PUBLIC_ASSOCIATED_DOMAIN;
const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://thebayaan.com/privacy';

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
      bundleIdentifier: 'com.bayaan.app',
      buildNumber: versionInfo.buildNumber,
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false,
      },
      teamId: APPLE_TEAM_ID,
      ...(ASSOCIATED_DOMAIN
        ? {associatedDomains: [`applinks:${ASSOCIATED_DOMAIN}`]}
        : {}),
      infoPlist: {
        NSMicrophoneUsageDescription:
          'This app uses the microphone to play audio.',
        NSAppleMusicUsageDescription:
          'This app uses Apple Music to play audio.',
        UILaunchStoryboardName: 'SplashScreen',
        LSRequiresIPhoneOS: true,
        UIRequiresFullScreen: true,
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
        UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
        'UISupportedInterfaceOrientations~ipad': [
          'UIInterfaceOrientationPortrait',
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
    // React Compiler disabled - causes performance issues with Zustand subscriptions
    // experiments: {
    //   reactCompiler: true,
    // },
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
        'expo-widgets',
        {
          widgets: [
            {
              name: 'AyahOfTheDay',
              displayName: 'Ayah of the Day',
              description:
                'A daily verse with English translation (Saheeh International).',
              supportedFamilies: ['systemSmall', 'systemMedium', 'systemLarge'],
            },
            {
              name: 'NowPlaying',
              displayName: 'Now Playing',
              description: 'What is playing in Bayaan.',
              supportedFamilies: ['systemSmall', 'systemMedium'],
            },
            {
              name: 'BayaanShortcuts',
              displayName: 'Bayaan',
              description: 'Open Mushaf, reciters, and playlists.',
              supportedFamilies: ['systemSmall', 'systemMedium'],
            },
          ],
        },
      ],
      ['expo-audio', {enableBackgroundPlayback: true}],
      'expo-sqlite',
      'expo-media-library',
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
    ],
  },
};

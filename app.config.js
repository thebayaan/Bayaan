export default {
  expo: {
    name: 'Bayaan',
    slug: 'Bayaan',
    scheme: 'bayaan',
    version: '0.1.0',
    cli: {
      appVersionSource: 'remote',
      version: '>= 5.9.1',
    },
    ios: {
      bundleIdentifier: 'com.bayaan.app',
      buildNumber: '1',
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false,
      },
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
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['bayaan'],
          },
        ],
        NSPrivacyPolicyURL:
          'https://osmansaeday.github.io/bayaan-privacy-policy',
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
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      postmarkApiKey: process.env.POSTMARK_API_KEY,
      postmarkFromEmail: process.env.POSTMARK_FROM_EMAIL,
      eas: {
        projectId: 'e31ace41-2d1b-4777-8230-8c8264277d59',
      },
      isDevelopmentMode: false,
    },
    android: {
      package: 'com.bayaan.app',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'bayaan',
              host: '*.supabase.co',
              pathPrefix: '/auth/callback',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    updates: {
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 2000,
      url: 'https://u.expo.dev/e31ace41-2d1b-4777-8230-8c8264277d59',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#f4f4f4',
          imageResizeMode: 'contain',
          dark: {
            image: './assets/images/splash-icon-dark.png',
            backgroundColor: '#1c1a1e',
          },
        },
      ],
    ],
  },
};

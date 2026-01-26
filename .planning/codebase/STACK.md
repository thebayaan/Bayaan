# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**
- TypeScript 5.3.3 - Core application language, enables strict type checking
- JavaScript - Build scripts and Node.js tooling

**Secondary:**
- JSON - Data files, configuration

## Runtime

**Environment:**
- Node.js - Required for build and script execution
- Expo SDK 52.0.25 - React Native framework with managed build system

**Package Manager:**
- npm (lock file version 3)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React Native 0.76.9 - Cross-platform mobile UI framework
- Expo Router 4.0.20 - File-based routing system (similar to Next.js), configured in `app.config.js`
- React 18.3.1 - Core UI library

**State Management:**
- Zustand 4.5.5 - Lightweight state management with persistence (`store/` directory)
- AsyncStorage - Persistent local storage via `@react-native-async-storage/async-storage` 1.23.1
- Expo SQLite 15.1.4 - SQLite database for playlists and structured data

**Audio:**
- react-native-track-player 4.1.1 - Background audio playback with media controls

**UI & Animation:**
- react-native-reanimated 3.16.1 - Performant gesture-driven animations
- moti 0.29.0 - Animation library for React Native
- @gorhom/bottom-sheet 4.6.4 - Bottom sheet modal component
- react-native-gesture-handler 2.25.0 - Native gesture handling
- @rneui/themed 4.0.0-rc.8 - UI component library with theming

**Images & Media:**
- react-native-fast-image 8.6.3 - Optimized image loading with caching

**Internationalization:**
- react-i18next 15.0.1 - Multi-language support with RTL layout support
- i18next 24.2.3 - i18n framework

**Other Utilities:**
- fuse.js 7.0.0 - Fuzzy search functionality
- semver 7.7.3 - Semantic versioning utilities
- colorthief 2.4.0 - Extract colors from images for dynamic theming

**Build/Dev:**
- Babel 7.20.0 - JavaScript transpiler
- Metro 0.81.0 - React Native bundler
- Prettier 3.3.3 - Code formatter
- ESLint 8.57.0 - Code linting
- Jest 29.2.1 - Test runner
- jest-expo 52.0.3 - Expo test configuration
- TypeScript - Static type checking
- ts-node 10.9.2 - TypeScript execution for scripts
- sharp 0.33.5 - Image processing for icon generation

## Key Dependencies

**Critical:**
- `react-native-track-player` 4.1.1 - Core audio playback system
- `expo-sqlite` 15.1.4 - Local data persistence for playlists
- `@react-native-async-storage/async-storage` 1.23.1 - Device-local storage
- `zustand` 4.5.5 - Application state management

**Infrastructure:**
- `expo-notifications` 0.29.13 - Push notifications and local alerts
- `expo-file-system` - File operations for downloads (`expo-file-system` implicit)
- `expo-updates` 0.27.4 - Over-the-air update support
- `expo-constants` 17.0.7 - App configuration constants
- `expo-device-info` 14.1.1 - Device information access
- `@supabase/supabase-js` 2.91.0 - Supabase client for data fetching (used in build scripts)

**Expo Modules:**
- `expo-router` 4.0.20 - File-based routing
- `expo-splash-screen` 0.29.22 - Splash screen management
- `expo-font` 13.0.3 - Custom font loading
- `expo-haptics` 14.0.1 - Haptic feedback
- `expo-status-bar` 2.0.1 - Status bar configuration
- `expo-web-browser` 14.0.2 - Web browser integration
- `expo-store-review` 8.0.1 - App store review prompts
- `expo-dev-client` 5.0.19 - Development client for debugging

## Configuration

**Environment:**
- `.env` file at project root containing:
  - `NODE_ENV` - Production/development mode
  - `SUPABASE_URL` - Supabase project endpoint
  - `SUPABASE_ANON_KEY` - Supabase anonymous key for data access
  - `APPLE_TEAM_ID` - Apple Team ID for iOS builds

**Build:**
- `app.config.js` - Expo configuration file specifying:
  - iOS configuration: bundle ID `com.bayaan.app`, team ID `S4W5Q2L53W`
  - Android configuration: package `com.bayaan.app`
  - Fonts: Manrope, Scheherazade, custom surah name fonts
  - Plugins: expo-router, expo-sqlite, expo-splash-screen, expo-notifications
  - Custom plugins: `withAndroidSigning.js`, `withIOSTeam.js`
  - OTA updates via Expo
- `tsconfig.json` - TypeScript strict mode enabled, path alias `@/*` points to root
- `.eslintrc.cjs` - ESLint configuration with React and TypeScript rules
- `.prettierrc.json` - Prettier formatter configuration
- `babel.config.js` - Babel configuration using `babel-preset-expo`

## Platform Requirements

**Development:**
- Xcode 15+ (for iOS development)
- Android Studio (for Android development)
- Node.js with npm
- Expo CLI

**Production:**
- iOS: Apple Developer account, iOS 13+
- Android: Google Play account, Android 8+ (API 26+)
- Over-the-air updates via Expo EAS

---

*Stack analysis: 2026-01-26*

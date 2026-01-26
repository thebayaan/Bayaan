# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
Bayaan/
├── .planning/              # GSD orchestration artifacts (planning, analysis)
├── app/                    # Expo Router screens and layouts (main navigation)
│   ├── _layout.tsx         # Root layout, app initialization
│   └── (tabs)/             # Tab-based main navigation structure
│       ├── _layout.tsx     # Tabs container
│       ├── (a.home)/       # Home tab (featured content, reciter selection)
│       ├── (b.search)/     # Search/browse tab (reciter catalog, surahs)
│       └── (c.collection)/ # Collection tab (playlists, loved, downloads)
├── assets/                 # Static assets
│   ├── fonts/              # Custom fonts (Manrope, Scheherazade, Uthmani, QPC)
│   ├── images/             # App icons, splash screens, logos
│   └── reciter-images/     # Generated reciter profile images
├── components/             # Reusable UI components organized by feature
│   ├── browse/             # Reciter/surah browsing components
│   ├── cards/              # Card components (SurahCard, ReciterCard, etc.)
│   ├── changelog/          # Version changelog display
│   ├── collection/         # Collection management components
│   ├── hero/               # Hero section components
│   ├── modals/             # Modal dialogs (WhatsNewModal, etc.)
│   ├── player/             # Player UI components (v2 implementation)
│   │   └── v2/             # Current player UI (floating, sheet)
│   ├── playlist-detail/    # Playlist view components
│   ├── providers/          # Context providers
│   ├── reciter-downloads/  # Download management UI
│   ├── reciter-profile/    # Reciter detail page components
│   ├── search/             # Search functionality components
│   ├── sheets/             # Action sheet definitions
│   ├── system-playlist/    # System playlist components
│   ├── utils/              # Component utility functions
│   ├── Button.tsx          # Reusable button component
│   ├── Header.tsx          # Common header
│   ├── Icons.tsx           # SVG icon library
│   ├── Input.tsx           # Text input component
│   ├── BottomTabBar.tsx    # Tab navigation bar
│   └── [Other UI components]
├── constants/              # Application constants
│   └── Colors.ts           # Color palette definitions
├── data/                   # Static data files (JSON and compiled TS)
│   ├── reciters.json       # Reciter catalog (fetched from Supabase)
│   ├── reciterData.ts      # Imported reciters.json as TS export
│   ├── reciters.json       # Reciter catalog (fetched from Supabase)
│   ├── surahData.ts        # Compiled Quranic surah metadata
│   ├── surahData.json      # Raw surah data
│   ├── systemPlaylists.ts  # Built-in playlists (Loved, Recently Played)
│   ├── categories.ts       # Reciter categories/collections
│   ├── featuredReciters.ts # Featured reciter selections
│   ├── juzData.ts          # Juz (part) divisions
│   ├── surahInfo.json      # Extended surah information
│   ├── changelog.json      # Version changelog
│   ├── quran.json          # Quranic text with metadata
│   ├── [Translation/Tajweed files] # Language-specific data
│   └── [Other reference files]
├── docs/                   # Project documentation
│   ├── architecture/       # Architecture documentation
│   ├── deployment/         # Build and release guides
│   ├── development/        # Development setup and workflows
│   ├── features/           # Feature-specific docs
│   └── testing/            # Testing guidelines
├── hooks/                  # Custom React hooks organized by domain
│   ├── usePlayback.ts      # Playback control and queue management
│   ├── useUnifiedPlayer.ts # Unified player interface hook
│   ├── usePlayerControls.ts # Player button actions
│   ├── usePlaylists.ts     # Playlist operations
│   ├── useQueue.ts         # Queue state access
│   ├── useReciterNavigation.ts # Reciter screen navigation
│   ├── useTheme.ts         # Theme selection and colors
│   ├── useLoved.ts         # Loved tracks management
│   ├── useFavoriteReciters.ts # Favorite reciter management
│   ├── useSettings.ts      # User settings access
│   └── [Other domain-specific hooks]
├── ios/                    # iOS native build artifacts
│   └── Bayaan.xcworkspace/ # Xcode workspace
├── android/                # Android native build artifacts
│   └── app/                # Android app module
├── scripts/                # Build and deployment scripts
│   ├── generateReciterImages.ts # Create reciter profile images
│   ├── generate-icons.js   # Generate app icons from source
│   ├── fetchReciterData.ts # Fetch and sync reciters from Supabase
│   ├── version-bump.js     # Semantic version management
│   ├── ios-archive.sh      # iOS archive/upload script
│   └── [Other automation]
├── services/               # Business logic and data operations
│   ├── AppInitializer.ts   # Centralized service initialization system
│   ├── dataService.ts      # Surah and reciter data access
│   ├── downloadService.ts  # Offline audio download management
│   ├── storageService.ts   # Device storage quota and cleanup
│   ├── StorageManager.ts   # Storage utilities
│   ├── QueueManager.ts     # Queue state and sequencing
│   ├── SurahLoader.ts      # Surah data lazy-loading
│   ├── emailService.ts     # Email utilities
│   ├── database/           # SQLite persistence layer
│   │   └── DatabaseService.ts # Playlist and data persistence
│   ├── player/             # Audio playback system
│   │   ├── store/          # Zustand stores (player, download, loved, progress)
│   │   ├── types/          # Type definitions for player
│   │   ├── utils/          # Player utilities (setup, storage, migration)
│   │   └── events/         # TrackPlayer event handling
│   ├── playlist/           # Playlist operations
│   │   └── PlaylistService.ts # High-level playlist API
│   └── queue/              # Queue management (may be consolidated with QueueManager)
├── store/                  # Zustand state management stores
│   ├── reciterStore.ts     # Default reciter selection
│   ├── queueStore.ts       # Queue state
│   ├── playlistsStore.ts   # User playlists list
│   ├── favoriteRecitersStore.ts # Favorite reciters
│   ├── recentRecitersStore.ts # Recently used reciters
│   ├── recentSurahStore.ts # Recently played surahs
│   ├── mushafSettingsStore.ts # Quran text display settings
│   ├── themeStore.ts       # Theme preference
│   ├── tajweedStore.ts     # Tajweed highlighting state
│   └── selectors.ts        # Reusable store selectors
├── styles/                 # Global style definitions
│   ├── theme.ts            # Theme system
│   ├── colorSchemes.ts     # Light/dark color palettes
│   ├── common.ts           # Shared style utilities
│   └── index.ts            # Style exports
├── theme/                  # Theme configuration
│   ├── index.ts            # Theme exports
│   └── [Theme definitions]
├── types/                  # TypeScript type definitions
│   ├── audio.ts            # Audio/track types
│   ├── reciter.ts          # Reciter type definitions
│   ├── quran.ts            # Quran-specific types
│   ├── playerColors.ts     # Player UI color types
│   ├── changelog.ts        # Changelog types
│   ├── reciter-profile.ts  # Reciter profile types
│   └── [Domain type files]
├── utils/                  # Utility functions and helpers
│   ├── audioUtils.ts       # Audio URL generation and smart caching
│   ├── artworkUtils.ts     # Album art extraction
│   ├── themeUtils.ts       # Theme utilities
│   ├── timeUtils.ts        # Time formatting and conversion
│   ├── validation.ts       # Input validation
│   ├── constants.ts        # App constants (dimensions, timings)
│   ├── storage.ts          # AsyncStorage helpers
│   ├── storeHydration.ts   # Zustand hydration utilities
│   ├── performance.ts      # Performance monitoring
│   ├── errorHandler.ts     # Error handling utilities
│   ├── haptics.ts          # Haptic feedback
│   ├── notificationUtils.ts # Notification helpers
│   ├── toastUtils.ts       # Toast message utilities
│   ├── tajweedLoader.ts    # Tajweed data preloading
│   ├── appVersion.ts       # Version management
│   ├── gradientColors.ts   # Color gradient utilities
│   └── [Other utilities]
├── .env                    # Environment variables (secrets)
├── .eslintrc.json          # ESLint configuration
├── .prettierrc              # Prettier formatting config
├── app.json                # Expo app configuration
├── eas.json                # EAS build configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── CLAUDE.md               # Claude Code project instructions
```

## Directory Purposes

**app/** - Expo Router Navigation & Screens
- Purpose: Define app navigation structure and render screens
- Contains: Screen components, layout definitions
- Convention: File-based routing (screens = routes)
- Key pattern: `_layout.tsx` files create nested navigation contexts
- Lazy loading: Tabs use `lazy: true` for performance

**(tabs)/** - Main Tab Navigation
- Purpose: Three-tab bottom navigation structure
- Tabs:
  1. `(a.home)` - Featured content, reciter quick-select
  2. `(b.search)` - Browse reciters catalog, search surahs
  3. `(c.collection)` - Playlists, loved tracks, downloads
- Pattern: Naming prefix `(a.)`, `(b.)`, `(c.)` for sort order

**components/** - Reusable UI Components
- Purpose: Shared, feature-agnostic UI building blocks
- Organization: Subdirectories by feature or component type
- Patterns:
  - Components are functional and memoized where appropriate
  - Props interfaces defined inline or as separate `Props` type
  - Styles via `StyleSheet.create()` or dynamic theme-based styles
  - Hooks used for stateful logic

**data/** - Static Reference Data
- Purpose: Immutable application data (Quran text, reciter catalog)
- Sources:
  - Local JSON files (bundled with app)
  - Imported from Supabase (via `fetchReciterData` script)
  - Compiled TypeScript exports
- Size: Large files (1-8MB) for translations, Tajweed, transliteration
- Usage: Accessed via `dataService` functions, not directly in components

**hooks/** - Custom React Hooks
- Purpose: Encapsulate stateful logic and store access
- Pattern: One hook per concern, exported as `use[Name]`
- Naming: Describe what they do (`usePlayback`, `usePlaylists`, `useTheme`)
- Store access: Hooks call Zustand stores via `useStore.getState()` or subscription

**services/** - Business Logic & Data Operations
- Purpose: Non-UI logic (player, downloads, data access)
- Organization:
  - Top-level: Service functions (`dataService`, `downloadService`)
  - Subdirectories: Complex subsystems (`player/`, `database/`, `playlist/`)
- Patterns:
  - Singleton pattern for managers (`QueueManager`, `StorageManager`)
  - Initialization pattern for database services (`initialize()` method)
  - Service registry pattern for `AppInitializer`

**services/player/** - Audio Playback System
- Purpose: Manage audio playback lifecycle
- Subdirectories:
  - `store/` - Zustand stores (playerStore, downloadStore, etc.)
  - `types/` - Type definitions (state, events, errors)
  - `utils/` - Utilities (setup, migration, storage)
  - `events/` - TrackPlayer event handling

**services/database/** - SQLite Persistence
- Purpose: Persist user data (playlists, items)
- Single file: `DatabaseService.ts`
- Responsibilities: Schema creation, CRUD operations, transactions
- Integration: Called by `PlaylistService` and `AppInitializer`

**store/** - Zustand State Management Stores
- Purpose: Persist and sync application state
- Pattern: Each store = one domain concern
- Persistence: All stores use `persist` middleware with AsyncStorage
- Structure:
  ```typescript
  create<StateType>()(
    persist(
      (set, get) => ({/* state and actions */}),
      {name: 'storage-key', storage: AsyncStorage}
    )
  )
  ```

**styles/** & **theme/** - Styling System
- Purpose: Centralized theme and color management
- Components:
  - `styles/colorSchemes.ts` - Light/dark color definitions
  - `theme/index.ts` - Theme object export
  - `useTheme()` hook - Access current theme in components
- Pattern: Functional components use `useTheme()` → access `theme.colors[colorName]`

**types/** - TypeScript Definitions
- Purpose: Shared type definitions across codebase
- Organization: One file per domain (audio.ts, reciter.ts, quran.ts)
- Convention: Exported interfaces and types, no implementations

**utils/** - Helper Functions
- Purpose: Reusable utility functions (not domain-specific)
- Categories:
  - Data transformation: `timeUtils.ts`, `validation.ts`
  - UI/Theme: `themeUtils.ts`, `artworkUtils.ts`
  - Storage/Performance: `storage.ts`, `performance.ts`
  - App-specific: `audioUtils.ts` (smart URL generation)

## Key File Locations

**Entry Points:**
- `app/_layout.tsx` - App bootstrap, initialization, root providers
- `app/(tabs)/_layout.tsx` - Main tab navigation setup
- `app/(tabs)/(a.home)/index.tsx` - Home screen (entry to playback)

**Configuration:**
- `app.json` - Expo app metadata and configuration
- `eas.json` - Expo Application Services build config
- `tsconfig.json` - TypeScript compiler options
- `.prettierrc` - Code formatting rules
- `.eslintrc.json` - Linting rules
- `package.json` - Dependencies and npm scripts

**Core Logic:**
- `services/AppInitializer.ts` - Service initialization orchestration
- `services/player/store/playerStore.ts` - Unified playback state
- `services/player/events/playbackService.ts` - TrackPlayer event listener
- `services/player/utils/setup.ts` - Player initialization
- `services/downloadService.ts` - Offline download management
- `services/playlist/PlaylistService.ts` - Playlist CRUD

**State Management:**
- `store/reciterStore.ts` - Default reciter persistence
- `store/playlistsStore.ts` - Playlists list state
- `services/player/store/downloadStore.ts` - Downloaded tracks
- `services/player/store/lovedStore.ts` - Liked/loved tracks

**Data Access:**
- `services/dataService.ts` - Surah and reciter queries
- `data/reciters.json` - Reciter catalog
- `data/surahData.ts` - Surah metadata
- `services/database/DatabaseService.ts` - SQLite operations

**Testing:**
- `utils/__tests__/` - Unit tests for utilities
- Each test file pairs with source file (e.g., `utils/timeUtils.ts` → `utils/__tests__/timeUtils.test.ts`)

## Naming Conventions

**Files:**
- Screens/Pages: `index.tsx` (exported as default from directory)
- Components: `ComponentName.tsx` (PascalCase, match component export)
- Utilities: `camelCase.ts` (function name matches file)
- Hooks: `useHookName.ts` (start with `use`, match export)
- Services: `ServiceName.ts` (PascalCase for classes, camelCase for modules)
- Tests: `name.test.ts` or `name.spec.ts`
- Styles: `_styles.ts` (underscore prefix for style files in directories)

**Directories:**
- Features: lowercase with hyphens (`player`, `reciter-downloads`, `playlist-detail`)
- Grouped routes: Parentheses with prefix (`(a.home)`, `(b.search)`, `(c.collection)`)
- Navigation groups: Match tab pattern for organization

**Functions:**
- Handlers: `handle[Action]` (e.g., `handlePress`, `handleSelectReciter`)
- Getters: `get[Data]` (e.g., `getReciterById`, `getQueue`)
- Setters: `set[Data]` (e.g., `setDefaultReciter`, `setSheetMode`)
- Async operations: `[noun|verb]Async` or just verb (e.g., `fetchReciters`, `downloadSurah`)

**Variables:**
- Flags/Booleans: `is[Name]` or `[name]` (e.g., `isLoading`, `isDarkMode`, `appIsReady`)
- State: `[noun]State` (e.g., `queueState`, `playbackState`)
- Constants: `UPPER_CASE` (e.g., `MAX_QUEUE_SIZE`, `BATCH_SIZE`)

**Components/Types:**
- React Components: `PascalCase` (e.g., `PlayerSheet`, `ReciterCard`)
- Props interfaces: `[ComponentName]Props` (e.g., `ButtonProps`, `PlayerSheetProps`)
- Type aliases: `PascalCase` (e.g., `Track`, `Reciter`, `PlaybackState`)

## Where to Add New Code

**New Feature:**
- UI Screens: `app/(tabs)/(appropriate-tab)/feature-name/`
- Feature components: `components/feature-name/`
- Feature hooks: `hooks/useFeatureName.ts`
- Feature service logic: `services/featureName/` (create directory if complex)
- Feature store: `store/featureNameStore.ts` or `services/featureName/store/`
- Feature tests: `utils/__tests__/` or `services/__tests__/` as appropriate

**New Component/Module:**
- Reusable components: `components/ComponentName.tsx` (or in subdirectory if many)
- One-off screen components: `app/(tabs)/[route]/ComponentName.tsx`
- Custom hooks: `hooks/useHookName.ts`
- Helper functions: `utils/helperName.ts`
- Service classes: `services/ServiceName.ts`

**Utilities:**
- Shared helpers: `utils/categoryName.ts` (e.g., `utils/audioUtils.ts`)
- Type definitions: `types/domainName.ts` (e.g., `types/audio.ts`)
- Constants: `constants/ConstantName.ts` or `utils/constants.ts`

**Tests:**
- Unit tests: `[file-being-tested]/__tests__/[test-file].test.ts`
- Or alongside source: `src/file.test.ts` (preferred pattern)
- Test utilities: `utils/__tests__/` subdirectory

**Styles:**
- Component-local styles: Define in component file via `StyleSheet.create()`
- Feature-wide styles: `app/(tabs)/[feature]/_styles.ts`
- Global styles: `styles/` directory for theme and common classes

## Special Directories

**ios/** - iOS Build Artifacts
- Purpose: Native iOS project (Xcode workspace)
- Generated: By `expo prebuild` command
- Committed: Yes (some files), but many generated
- Important: `ios/Bayaan.xcworkspace` used for development/archiving
- Credentials: iOS team ID configured via `withIOSTeam.js` plugin

**android/** - Android Build Artifacts
- Purpose: Native Android project (Gradle)
- Generated: By `expo prebuild` command
- Committed: Yes (some files), but many generated
- Important: `android/app/build/outputs/bundle/release/` contains AAB
- Keystore: `~/Documents/app-credentials/bayaan/keystore/bayaan-upload-key.keystore`

**build/** - Archive Outputs
- Purpose: Storage for archived builds
- Generated: `ios/build/` and `build/Bayaan.xcarchive` for iOS
- Contents: Compiled app archives, export metadata
- Lifecycle: Temporary, can be cleared after upload

**dist/** - Distribution Artifacts
- Purpose: Could be used for web builds or distribution outputs
- Status: Present but appears unused currently

**.planning/codebase/** - GSD Documentation
- Purpose: Analysis documents for orchestration (this file location)
- Contents: ARCHITECTURE.md, STRUCTURE.md, STACK.md, etc.
- Lifecycle: Generated by `/gsd:map-codebase` command

**docs/** - Project Documentation
- Purpose: Human-readable guides and architecture decisions
- Subdirectories:
  - `architecture/` - System design docs
  - `deployment/` - Build and release procedures
  - `development/` - Dev environment setup
  - `features/` - Feature-specific documentation
  - `testing/` - Testing strategies

**.expo/** - Expo Cache & Config
- Purpose: Expo CLI cache and project metadata
- Generated: By Expo CLI
- Committed: No (gitignored)

**node_modules/** - Dependencies
- Purpose: Installed npm packages
- Committed: No (gitignored)
- Large: ~1GB, regenerated via `npm install`

---

*Structure analysis: 2026-01-26*

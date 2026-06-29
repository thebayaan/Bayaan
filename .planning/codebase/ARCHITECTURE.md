# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Layered Client-Server Architecture with State Management

Bayaan is a React Native/Expo application built on a **layered architecture** with clear separation of concerns:

1. **Presentation Layer** - UI components, screens, animations
2. **State Management Layer** - Zustand stores for persistent and volatile state
3. **Service Layer** - Audio playback, downloads, data operations, database
4. **Data Layer** - Local SQLite, AsyncStorage, remote Supabase integration
5. **Utility Layer** - Helpers, formatters, validators

**Key Characteristics:**

- **Modular and Feature-Based** - Organized by domain (player, queue, playlist, downloads)
- **Reactive State Management** - Zustand stores with AsyncStorage persistence
- **Service Initialization System** - Centralized app startup via `AppInitializer`
- **Expo Router Navigation** - File-based routing with nested layouts
- **Type-Safe** - Strict TypeScript with comprehensive type definitions
- **Performance-Optimized** - Lazy loading, memoization, efficient queue management

## Layers

**Presentation Layer:**

- Purpose: Render UI and handle user interactions
- Location: `app/` (screens), `components/` (reusable components)
- Contains: Screen components, UI elements, animations, styles
- Depends on: Hooks, stores, theme utilities
- Used by: Direct user interaction

**Routing & Navigation:**

- Purpose: Manage screen navigation and state persistence
- Location: `app/` directory with Expo Router layout files
- Pattern: File-based routing with `_layout.tsx` for shared UI
- Structure: Nested group folders like `(a.home)`, `(b.search)`, `(c.collection)`

**State Management Layer:**

- Purpose: Persist and manage application state
- Location: `store/` and `services/player/store/`
- Contains: Zustand stores with AsyncStorage persistence
- Patterns:
  - Global stores: `reciterStore`, `queueStore`, `playlistsStore`, `favoriteRecitersStore`, `themeStore`
  - Player-specific stores: `playerStore`, `downloadStore`, `lovedStore`, `progressStore`
  - All stores use Zustand `persist` middleware for AsyncStorage synchronization
- Dependencies: AsyncStorage for persistence layer

**Service Layer:**

- Purpose: Business logic, data operations, external integrations
- Location: `services/` directory
- Core Services:
  - `AppInitializer.ts` - Priority-based service initialization with critical/non-critical classification
  - `dataService.ts` - Surah and reciter data access (static JSON data)
  - `downloadService.ts` - Offline audio file download management
  - `DatabaseService` - SQLite wrapper for playlist persistence
  - `PlaylistService` - Playlist CRUD operations via database
  - `QueueManager` - Queue state and track sequencing
  - `StorageManager` - Local storage quota and cleanup
  - Player Service (`player/`) - Audio playback coordination
- Depends on: Data layer, external libraries (TrackPlayer, Supabase)
- Used by: Hooks, components, app initialization

**Audio Playback System:**

- Purpose: Manage audio playback state and queue
- Location: `services/player/`
- Components:
  - `playerStore.ts` - Unified playback state (position, rate, repeat, shuffle)
  - `playbackService.ts` - TrackPlayer event listener registration
  - `setup.ts` - Player initialization and configuration
  - `bridge.ts` - Event bridge between TrackPlayer and Zustand
  - `downloadStore.ts` - Downloaded tracks and offline playback state
  - `lovedStore.ts` - Liked tracks persistence
  - `progressStore.ts` - Playback progress tracking
- Data Flow: TrackPlayer events → Event bridge → playerStore updates → UI re-renders

**Data Layer:**

- Purpose: Persist data and access external APIs
- Location: `services/database/`, Supabase (cloud)
- Storage Methods:
  - SQLite: Playlists, user-created content via `DatabaseService`
  - AsyncStorage: Store hydration, Zustand persist middleware
  - Local FileSystem: Downloaded audio files via `expo-file-system`
  - Supabase: Reciter metadata, rewayat information, audio file CDN
- Flow: Service → Database/Storage → Zustand store → Components

**Utility Layer:**

- Purpose: Shared helper functions, formatters, validators
- Location: `utils/` directory
- Categories:
  - `audioUtils.ts` - Audio URL generation, smart caching
  - `artworkUtils.ts` - Album art extraction and caching
  - `themeUtils.ts` - Theme switching, color management
  - `timeUtils.ts` - Time formatting and conversion
  - `validation.ts` - Input validation and schemas
  - `storage.ts` - AsyncStorage helpers
  - `constants.ts` - Application constants

## Data Flow

**Playback Session Flow:**

1. User selects Surah/Reciter from UI
2. Hook (`usePlayback`) prepares queue:
  - Calls `QueueManager.getInstance()`
  - Loads initial batch (3 tracks) from `dataService`
  - Builds `Track[]` objects with remote URLs
3. `playerStore.loadAndPlayTrack()` called:
  - Updates TrackPlayer queue via `TrackPlayer.add()`
  - Sets current position and start playback
4. TrackPlayer fires `PlaybackState` event
5. Event bridge (`setupEventBridge`) captures event
6. Event listener updates `playerStore` with new state
7. Components subscribed to `playerStore` re-render
8. UI reflects current position, playback state, rate

**Queue Loading (Lazy):**

- Initial load: 3 tracks
- When position approaches end (threshold=2), load next batch (5 tracks)
- Prevents memory bloat while ensuring smooth playback
- Implementation: `usePlayback.ts` manages `loadNextBatch()`

**Download Flow:**

1. User initiates download from UI
2. `downloadService.downloadSurah()` called:
  - Calls `dataService.fetchAudioUrl()` to get remote URL
  - Uses `expo-file-system` to download to device
  - Returns file path and size
3. `downloadStore` updated with `DownloadedSurah` record
4. Next playback: `audioUtils.generateSmartAudioUrl()` returns local path if available
5. TrackPlayer loads from local filesystem instead of network

**Playlist Persistence:**

1. User creates/modifies playlist via UI
2. `PlaylistService.createPlaylist()` or `addToPlaylist()` called
3. Operations wrapped in SQLite transaction (critical services)
4. Database updated with playlist metadata and items
5. `usePlaylistsStore` listens for changes
6. On app startup: `AppInitializer` calls `playlistService.initialize()` then `usePlaylistsStore.loadPlaylists()`
7. Playlist data loaded into Zustand store and available to components

**State Restoration on App Cold Start:**

1. `app/_layout.tsx` boots up
2. Fonts loaded, player initialized
3. `AppInitializer.initialize()` called:
  - Database initialized (critical)
  - PlaylistService initialized (critical)
  - Playlists data loaded from DB → `usePlaylistsStore`
4. Zustand stores hydrate from AsyncStorage via `persist` middleware
5. Previous playback state, selections, settings restored
6. UI renders with restored state

## Key Abstractions

**UnifiedPlayerState:**

- Purpose: Represent complete player state across multiple stores
- Location: `services/player/types/state.ts`
- Composition:
  ```
  UnifiedPlayerState {
    playback: PlaybackState (position, duration, rate)
    queue: QueueState (tracks, currentIndex)
    settings: PlaybackSettings (repeat, shuffle, sleepTimer)
    loading: LoadingState (trackLoading, queueLoading)
    error: ErrorState (playback, queue, system)
  }
  ```
- Used by: `playerStore`, UI components accessing playback info

**Track Type:**

- Purpose: Unified representation of audio playable item
- Location: `types/audio.ts`
- Properties: URL, duration, title (surah name), artist (reciter), artwork
- Used across: Queue, downloads, recently played, loved tracks

**Reciter & Rewayat:**

- Purpose: Represent Quranic recitation source and variant
- Structure:
  - `Reciter`: Name, image, collection of `Rewayat`
  - `Rewayat`: Specific reading style, base URL to audio files, available surahs
- Data Source: `data/reciters.json` (fetched from Supabase, cached locally)
- Used by: Player URL generation, reciter selection screens

**QueueManager:**

- Purpose: Centralized queue state and operations
- Location: `services/QueueManager.ts`
- Responsible for: Track sequencing, batch loading logic, queue navigation
- Singleton pattern: Accessed via `getInstance()`

**AppInitializer:**

- Purpose: Orchestrate service startup with priority-based ordering
- Pattern: Service registry with dependency management
- Features:
  - Idempotent initialization (safe to call multiple times)
  - Critical vs non-critical service handling
  - Priority ordering (lower number = higher priority)
  - Logging and error tracking
- Registration: Services added at bottom of `services/AppInitializer.ts`

## Entry Points

**App Bootstrap:**

- Location: `app/_layout.tsx`
- Triggers: App launch
- Responsibilities:
  - Font loading
  - TrackPlayer registration (`TrackPlayer.registerPlaybackService()`)
  - AppInitializer execution
  - Zustand store pre-warming (triggers hydration from AsyncStorage)
  - SplashScreen management
  - Root providers setup (SafeAreaProvider, SheetProvider, ErrorBoundary)
  - Theme/platform configuration

**Root Navigation:**

- Location: `app/(tabs)/_layout.tsx`
- Pattern: Tab-based navigation
- Structure:
  - `(a.home)` - Home/featured content
  - `(b.search)` - Search/browse reciters and surahs
  - `(c.collection)` - User's playlists, loved tracks, downloads

**Home Screen:**

- Location: `app/(tabs)/(a.home)/index.tsx`
- Entry point for: Reciter selection, Surah browsing
- Connects to: Player initialization, featured content display

**Search/Browse:**

- Location: `app/(tabs)/(b.search)/`
- Functionality: Reciter discovery, Surah catalog, full-text search

**Collections:**

- Location: `app/(tabs)/(c.collection)/`
- Functionality: Playlists, loved tracks, offline downloads management

## Error Handling

**Strategy:** Graceful degradation with error boundaries and try-catch

**Patterns:**

1. **Component Level:**
  - ErrorBoundary wrapper (`components/ErrorBoundary.tsx`) catches render errors
  - Returns fallback UI or error message
2. **Async Operations:**
  - Try-catch in service methods
  - Errors captured in store (`playerStore.setError()`)
  - UI checks error state and displays appropriate feedback
3. **Player Setup:**
  - Initialization errors caught in `app/_layout.tsx`
  - Max retry attempts enforced (3 tries with 1s delay)
  - If player setup fails after retries, show error screen
4. **Critical vs Non-Critical Services:**
  - Critical service failure: Blocks app startup (`AppInitializer`)
  - Non-critical service failure: Logged, app continues
  - Examples:
    - Critical: Database, Playlist service
    - Non-critical: Tajweed data preload
5. **Error Types:**
  - Location: `services/player/types/errors.ts`
  - Categories: Playback errors, queue errors, system errors
  - Each tracked in `playerStore.error` state

## Cross-Cutting Concerns

**Logging:**

- Framework: `console` (native React Native)
- Convention: Prefixed with module name `[ModuleName] message`
- Examples: `[App]`, `[AppInitializer]`, `[PlayerStore]`, `[PlaylistService]`
- Level: info, warn, error (used consistently)

**Validation:**

- Tool: Zod for schema validation
- Location: `services/player/store/validation.ts`
- Usage: Input validation in services, default state creation
- Pattern: Validate early, throw or return error

**Authentication:**

- Type: Supabase anonymous key (public read-only access)
- Usage: Fetch reciter metadata from Supabase
- No user accounts: App is standalone player, no auth required

**Internationalization:**

- Framework: `react-i18next`
- Namespaces: App strings, UI labels
- RTL Support: Built-in for Arabic content
- Data languages: Surahs have Arabic and English names

**Theme Management:**

- Location: `theme/` directory
- System: Light/dark mode based on device settings
- Implementation:
  - `useTheme()` hook provides current theme
  - `theme.ts` defines color schemes
  - Zustand `themeStore` persists user preference
  - Components use theme colors for styling

**Performance Monitoring:**

- Location: `utils/performance.ts`
- Approach: Manual timing with `console.time/timeEnd`
- Key metrics: Service initialization times, load operations
- No external analytics (privacy-focused)

---

*Architecture analysis: 2026-01-26*
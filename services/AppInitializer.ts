import {databaseService} from '@/services/database/DatabaseService';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {playlistService} from '@/services/playlist/PlaylistService';
import {uploadsService} from '@/services/uploads/UploadsService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {warmBookmarkCache} from '@/components/mushaf/BookmarkChips';
import {timestampService} from '@/services/timestamps/TimestampService';
import {useAdhkarStore} from '@/store/adhkarStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {useUploadsStore} from '@/store/uploadsStore';
import {useReciterStore} from '@/store/reciterStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useAdhkarSettingsStore} from '@/store/adhkarSettingsStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useThemeStore} from '@/store/themeStore';
import {useRecentRecitersStore} from '@/store/recentRecitersStore';
import {useRecentSurahsStore} from '@/store/recentSurahStore';
import {usePlayCountStore} from '@/store/playCountStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import * as Font from 'expo-font';

interface ServiceInitializer {
  name: string;
  initialize: () => Promise<void>;
  priority?: number; // Lower number = higher priority
  critical?: boolean; // If true, failure will prevent app startup
}

/**
 * AppInitializer - Centralized service initialization system
 *
 * This class manages the initialization of all SQLite-based services
 * and other critical app services. It ensures:
 * - Services are initialized in the correct order
 * - Initialization is idempotent (safe to call multiple times)
 * - Concurrent initialization requests are handled gracefully
 * - Non-critical services can fail without breaking the app
 *
 * @example
 * ```typescript
 * // In app startup (_layout.tsx)
 * await appInitializer.initialize();
 *
 * // To add a new service (in AppInitializer.ts)
 * appInitializer.registerService({
 *   name: 'Bookmarks',
 *   priority: 4,
 *   critical: false,
 *   initialize: async () => {
 *     await bookmarksService.initialize();
 *     await useBookmarksStore.getState().loadBookmarks();
 *   },
 * });
 * ```
 */
class AppInitializer {
  private initPromise: Promise<void> | null = null;
  private initialized = false;
  private services: ServiceInitializer[] = [];

  /**
   * Register a service to be initialized
   * Services are executed in priority order (lower number = higher priority)
   *
   * @param service - Service configuration
   */
  registerService(service: ServiceInitializer) {
    this.services.push(service);
    // Sort by priority (lower number first)
    this.services.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /**
   * Initialize all registered services
   * This is idempotent and safe to call multiple times
   *
   * @returns Promise that resolves when all services are initialized
   * @throws Error if any critical service fails to initialize
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[AppInitializer] Already initialized');
      return;
    }

    if (this.initPromise) {
      console.log('[AppInitializer] Initialization in progress, waiting...');
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[AppInitializer] Starting initialization...');
        const startTime = Date.now();

        // Split into critical (sequential) and non-critical (parallel)
        const critical = this.services.filter(s => s.critical);
        const nonCritical = this.services.filter(s => !s.critical);

        // Run critical services sequentially (order matters)
        for (const service of critical) {
          const serviceStartTime = Date.now();
          console.log(`[AppInitializer] Initializing ${service.name}...`);
          await service.initialize();
          const serviceTime = Date.now() - serviceStartTime;
          console.log(
            `[AppInitializer] ✓ ${service.name} initialized (${serviceTime}ms)`,
          );
        }

        // Run non-critical services in parallel
        if (nonCritical.length > 0) {
          console.log(
            `[AppInitializer] Running ${nonCritical.length} non-critical services in parallel...`,
          );
          const results = await Promise.allSettled(
            nonCritical.map(async service => {
              const serviceStartTime = Date.now();
              console.log(`[AppInitializer] Initializing ${service.name}...`);
              await service.initialize();
              const serviceTime = Date.now() - serviceStartTime;
              console.log(
                `[AppInitializer] ✓ ${service.name} initialized (${serviceTime}ms)`,
              );
            }),
          );

          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.warn(
                `[AppInitializer] Non-critical service ${nonCritical[index].name} failed, continuing...`,
                result.reason,
              );
            }
          });
        }

        this.initialized = true;
        const totalTime = Date.now() - startTime;
        console.log(
          `[AppInitializer] All services initialized successfully (${totalTime}ms total)`,
        );
      } catch (error) {
        console.error('[AppInitializer] Initialization failed:', error);
        this.initPromise = null; // Allow retry
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Reset initialization state
   * Useful for testing or development
   */
  reset() {
    this.initialized = false;
    this.initPromise = null;
    console.log('[AppInitializer] Reset');
  }

  /**
   * Check if all services have been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get list of registered services
   */
  getServices(): ReadonlyArray<Readonly<ServiceInitializer>> {
    return this.services;
  }
}

// Create singleton instance
export const appInitializer = new AppInitializer();

// ============================================================================
// SERVICE REGISTRATION
// Register all services that need initialization here
// Priority order: 0 = highest priority (initialized first)
// ============================================================================

/**
 * Database Service (Priority 1)
 * Initializes the SQLite database connection and creates tables
 * This is critical - app cannot function without it
 */
appInitializer.registerService({
  name: 'Database',
  priority: 1,
  critical: true,
  initialize: async () => {
    await databaseService.initialize();
  },
});

/**
 * Playlist Service (Priority 2)
 * Initializes the playlist service (depends on Database)
 * This is critical for playlist functionality
 */
appInitializer.registerService({
  name: 'Playlist Service',
  priority: 2,
  critical: true,
  initialize: async () => {
    await playlistService.initialize();
  },
});

/**
 * Playlists Data (Priority 3)
 * Loads playlist data from database into Zustand store
 * Non-critical - can be loaded later if fails
 */
appInitializer.registerService({
  name: 'Playlists Data',
  priority: 3,
  critical: false,
  initialize: async () => {
    await usePlaylistsStore.getState().loadPlaylists();
  },
});

/**
 * Adhkar Service (Priority 4)
 * Initializes the Adhkar database and seeds data (depends on Database)
 * Non-critical - app can function without adhkar
 */
appInitializer.registerService({
  name: 'Adhkar Service',
  priority: 4,
  critical: false,
  initialize: async () => {
    await adhkarService.initialize();
  },
});

/**
 * Mushaf Preload (Priority 5)
 * Loads DigitalKhatt data, Skia typefaces (V1+V2), and surah header font.
 * Eliminates loading screens in the Mushaf tab by having everything ready
 * before the user navigates there.
 * Non-critical - Mushaf tab will render empty frames until ready (rare race).
 */
appInitializer.registerService({
  name: 'Mushaf Preload',
  priority: 5,
  critical: false,
  initialize: async () => {
    await mushafPreloadService.initialize();
  },
});

/**
 * Adhkar Store Data (Priority 6)
 * Loads adhkar categories from database into Zustand store
 * Non-critical - can be loaded later if fails
 */
appInitializer.registerService({
  name: 'Adhkar Store Data',
  priority: 6,
  critical: false,
  initialize: async () => {
    await useAdhkarStore.getState().loadCategories();
  },
});

/**
 * Uploads Service (Priority 7)
 * Initializes the uploads database and loads recitations into store
 * Non-critical - app can function without uploads
 */
appInitializer.registerService({
  name: 'Uploads Service',
  priority: 6,
  critical: false,
  initialize: async () => {
    await uploadsService.initialize();
    await useUploadsStore.getState().loadRecitations();
    await useUploadsStore.getState().loadCustomReciters();
    await uploadsService.maybeRunOrphanCleanup();
  },
});

/**
 * Verse Annotations Service (Priority 7)
 * Initializes the verse annotations database for bookmarks, notes, highlights
 * Non-critical - app can function without verse annotations
 */
appInitializer.registerService({
  name: 'Verse Annotations',
  priority: 7,
  critical: false,
  initialize: async () => {
    await verseAnnotationService.initialize();
    await warmBookmarkCache();
  },
});

/**
 * Timestamp Service (Priority 9)
 * Copies bundled timestamps.db to writable directory and opens it
 * Non-critical - app can function without ayah timestamps
 */
appInitializer.registerService({
  name: 'Timestamps',
  priority: 9,
  critical: false,
  initialize: async () => {
    await timestampService.initialize();
  },
});

/**
 * Arabic Fonts (Priority 10)
 * Loads Arabic/Quran fonts during initialization (while splash is showing)
 * instead of after splash hides, preventing text flashes.
 * Non-critical - fonts can still be loaded lazily if this fails.
 */
appInitializer.registerService({
  name: 'Arabic Fonts',
  priority: 10,
  critical: false,
  initialize: async () => {
    await Font.loadAsync({
      'ScheherazadeNew-Regular': require('@/assets/fonts/ScheherazadeNew-Regular.ttf'),
      'ScheherazadeNew-Medium': require('@/assets/fonts/ScheherazadeNew-Medium.ttf'),
      'ScheherazadeNew-Bold': require('@/assets/fonts/ScheherazadeNew-Bold.ttf'),
      'ScheherazadeNew-SemiBold': require('@/assets/fonts/ScheherazadeNew-SemiBold.ttf'),
      Uthmani: require('@/assets/fonts/Uthmani.otf'),
      QPC: require('@/assets/fonts/UthmanicHafs1Ver18.ttf'),
      DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
      DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf'),
    });
  },
});

/**
 * QUL Data Service (Priority 10)
 * Opens ayah-themes, matching-ayah, and mutashabihat SQLite databases.
 * Used for verse themes, similar ayahs, and shared phrases in mushaf sheets.
 * Non-critical - similar verses features degrade gracefully without it.
 */
appInitializer.registerService({
  name: 'QUL Data',
  priority: 10,
  critical: false,
  initialize: async () => {
    await qulDataService.initialize();
  },
});

/**
 * Store Hydration (Priority 3)
 * Pre-warms all persisted Zustand stores so AsyncStorage reads complete
 * before the user interacts with the app.
 * Non-critical - stores will hydrate lazily on first access if this fails.
 * Note: useDownloadStore and usePlayerStore are already pre-warmed in prepare().
 */
appInitializer.registerService({
  name: 'Store Hydration',
  priority: 3,
  critical: false,
  initialize: async () => {
    useReciterStore.getState();
    useAmbientStore.getState();
    useAdhkarSettingsStore.getState();
    useMushafSettingsStore.getState();
    useThemeStore.getState();
    useRecentRecitersStore.getState();
    useRecentSurahsStore.getState();
    usePlayCountStore.getState();
    useLovedStore.getState();
    useRecentlyPlayedStore.getState();
    useFavoriteRecitersStore.getState();
  },
});

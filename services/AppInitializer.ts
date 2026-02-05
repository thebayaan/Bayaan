import {databaseService} from '@/services/database/DatabaseService';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {playlistService} from '@/services/playlist/PlaylistService';
import {useAdhkarStore} from '@/store/adhkarStore';
import {usePlaylistsStore} from '@/store/playlistsStore';
import {setAudioModeAsync} from 'expo-audio';

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

        for (const service of this.services) {
          try {
            const serviceStartTime = Date.now();
            console.log(`[AppInitializer] Initializing ${service.name}...`);

            await service.initialize();

            const serviceTime = Date.now() - serviceStartTime;
            console.log(
              `[AppInitializer] ✓ ${service.name} initialized (${serviceTime}ms)`,
            );
          } catch (error) {
            console.error(`[AppInitializer] ✗ ${service.name} failed:`, error);

            // If this is a critical service, throw the error
            if (service.critical) {
              throw new Error(
                `Critical service ${service.name} failed: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              );
            }

            // Non-critical services log but don't break initialization
            console.warn(
              `[AppInitializer] Non-critical service ${service.name} failed, continuing...`,
            );
          }
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
 * Audio Configuration (Priority 0)
 * Configures expo-audio for background playback support
 * Non-critical - app can function without background audio
 */
appInitializer.registerService({
  name: 'Audio Configuration',
  priority: 0,
  critical: false,
  initialize: async () => {
    await setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionModeAndroid: 'duckOthers',
      interruptionMode: 'duckOthers',
    });
  },
});

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
 * Adhkar Store Data (Priority 5)
 * Loads adhkar categories from database into Zustand store
 * Non-critical - can be loaded later if fails
 */
appInitializer.registerService({
  name: 'Adhkar Store Data',
  priority: 5,
  critical: false,
  initialize: async () => {
    await useAdhkarStore.getState().loadCategories();
  },
});

// ============================================================================
// FUTURE SERVICES
// Add new services below as your app grows
// ============================================================================

/*
 * Example: Bookmarks Service
 *
 * appInitializer.registerService({
 *   name: 'Bookmarks',
 *   priority: 4,
 *   critical: false,
 *   initialize: async () => {
 *     await bookmarksService.initialize();
 *     await useBookmarksStore.getState().loadBookmarks();
 *   },
 * });
 */

/*
 * Example: Notes Service
 *
 * appInitializer.registerService({
 *   name: 'Notes',
 *   priority: 5,
 *   critical: false,
 *   initialize: async () => {
 *     await notesService.initialize();
 *     await useNotesStore.getState().loadNotes();
 *   },
 * });
 */

/*
 * Example: Reading History Service
 *
 * appInitializer.registerService({
 *   name: 'Reading History',
 *   priority: 6,
 *   critical: false,
 *   initialize: async () => {
 *     await historyService.initialize();
 *     await useHistoryStore.getState().loadHistory();
 *   },
 * });
 */

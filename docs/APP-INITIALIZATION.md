# App Initialization Architecture

## Overview

The Bayaan app uses a centralized initialization system (`AppInitializer`) to manage all SQLite-based services and critical app data loading. This ensures consistent, reliable, and performant app startup.

## Architecture

### Key Components

1. **AppInitializer** (`services/AppInitializer.ts`)
   - Central orchestrator for all service initialization
   - Manages initialization order via priority system
   - Handles critical vs non-critical service failures
   - Provides idempotent, mutex-protected initialization

2. **Service Registration**
   - Services register themselves with priorities
   - Lower priority number = initialized first
   - Critical services block app startup on failure
   - Non-critical services log errors but allow startup

3. **Initialization Flow**
   ```
   App Startup (_layout.tsx)
   ├─> Font Loading
   ├─> Player Setup
   ├─> Tajweed Preload (background)
   └─> AppInitializer.initialize()
       ├─> Database Service (Priority 1, Critical)
       ├─> Playlist Service (Priority 2, Critical)
       ├─> Playlists Data Load (Priority 3, Non-critical)
       └─> [Future services...]
   ```

## How It Works

### 1. Service Registration

Services are registered in `services/AppInitializer.ts`:

```typescript
appInitializer.registerService({
  name: 'Database',           // Display name for logging
  priority: 1,                // Lower = higher priority
  critical: true,             // Failure blocks app startup
  initialize: async () => {   // Initialization function
    await databaseService.initialize();
  },
});
```

### 2. Initialization Execution

When `appInitializer.initialize()` is called (in `app/_layout.tsx`):

1. **Idempotency Check**: Returns immediately if already initialized
2. **Mutex Protection**: Waits if initialization is in progress
3. **Sequential Execution**: Runs services in priority order
4. **Error Handling**:
   - Critical service failure → Throws error, blocks app
   - Non-critical service failure → Logs warning, continues
5. **Performance Logging**: Times each service and total initialization

### 3. Preloading Benefits

- **No Loading States**: Data ready before screens mount
- **Fast Navigation**: Collection screen opens instantly
- **Parallel Loading**: Happens during splash screen display
- **Error Resilience**: Non-critical failures don't break app

## Data Loading Patterns

### SQLite Data (Playlists, Bookmarks, Notes)

**Problem**: Unlike AsyncStorage (used by loved tracks, downloads), SQLite requires manual initialization and loading.

**Solution**: AppInitializer preloads during app startup.

```typescript
// ❌ OLD: Load on-demand (slow, visible loading)
useEffect(() => {
  loadPlaylists(); // Runs when collection screen opens
}, []);

// ✅ NEW: Preloaded (instant, no loading)
// AppInitializer loads before screen mounts
// Hook just accesses already-loaded data
const { playlists } = usePlaylists();
```

### AsyncStorage Data (Loved, Downloads, Favorites)

**Already Optimized**: Uses Zustand's `persist` middleware.

```typescript
// Automatically rehydrates on app startup
export const useLovedStore = create<LovedTracksState>()(
  persist(
    (set, get) => ({ /* store logic */ }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

## Adding New Services

### Step 1: Create the Service

```typescript
// services/bookmarks/BookmarkService.ts
import {databaseService} from '@/services/database/DatabaseService';

class BookmarkService {
  async initialize(): Promise<void> {
    await databaseService.initialize();
    // Service-specific initialization
  }

  async getBookmarks(): Promise<Bookmark[]> {
    // Implementation
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    // Implementation
  }
}

export const bookmarksService = new BookmarkService();
```

### Step 2: Create the Store

```typescript
// store/bookmarksStore.ts
import {create} from 'zustand';
import {bookmarksService} from '@/services/bookmarks/BookmarkService';

interface BookmarksState {
  bookmarks: Bookmark[];
  loading: boolean;
  loadBookmarks: () => Promise<void>;
  addBookmark: (bookmark: Bookmark) => Promise<void>;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  bookmarks: [],
  loading: true,

  loadBookmarks: async () => {
    try {
      set({loading: true});
      const bookmarks = await bookmarksService.getBookmarks();
      set({bookmarks, loading: false});
    } catch (err) {
      set({loading: false});
      throw err;
    }
  },

  addBookmark: async (bookmark) => {
    await bookmarksService.addBookmark(bookmark);
    await get().loadBookmarks();
  },
}));
```

### Step 3: Register with AppInitializer

```typescript
// services/AppInitializer.ts
// Add to the service registration section:

appInitializer.registerService({
  name: 'Bookmarks',
  priority: 4,              // After playlists
  critical: false,          // Optional feature
  initialize: async () => {
    await bookmarksService.initialize();
    await useBookmarksStore.getState().loadBookmarks();
  },
});
```

### Step 4: Create the Hook (Optional)

```typescript
// hooks/useBookmarks.ts
import {useBookmarksStore} from '@/store/bookmarksStore';

export const useBookmarks = () => {
  const bookmarks = useBookmarksStore(state => state.bookmarks);
  const loading = useBookmarksStore(state => state.loading);
  const loadBookmarks = useBookmarksStore(state => state.loadBookmarks);
  const addBookmark = useBookmarksStore(state => state.addBookmark);

  // Safety fallback (rarely needed)
  useEffect(() => {
    if (bookmarks.length === 0 && !loading) {
      console.warn('[useBookmarks] Not preloaded, loading as fallback...');
      loadBookmarks();
    }
  }, []);

  return { bookmarks, loading, loadBookmarks, addBookmark };
};
```

### Step 5: Use in Components

```typescript
// app/(tabs)/bookmarks.tsx
import {useBookmarks} from '@/hooks/useBookmarks';

export default function BookmarksScreen() {
  const { bookmarks, loading } = useBookmarks();

  // Data is already loaded! No useEffect needed.
  if (loading) return <Loading />;
  
  return <BookmarksList bookmarks={bookmarks} />;
}
```

## Priority Guidelines

| Priority | Type | Example | Critical? |
|----------|------|---------|-----------|
| 1-10 | Infrastructure | Database, Storage | ✅ Yes |
| 11-20 | Core Services | Playlists, Queue | ✅ Yes |
| 21-30 | Feature Data | Bookmarks, Notes | ❌ No |
| 31-40 | Auxiliary | History, Stats | ❌ No |
| 41+ | Optional | Experiments | ❌ No |

## Debugging

### Enable Detailed Logging

The AppInitializer logs automatically:

```
[AppInitializer] Starting initialization...
[AppInitializer] Initializing Database...
[AppInitializer] ✓ Database initialized (45ms)
[AppInitializer] Initializing Playlist Service...
[AppInitializer] ✓ Playlist Service initialized (12ms)
[AppInitializer] Initializing Playlists Data...
[AppInitializer] ✓ Playlists Data initialized (89ms)
[AppInitializer] All services initialized successfully (146ms total)
```

### Check Initialization Status

```typescript
import {appInitializer} from '@/services/AppInitializer';

// Check if initialized
if (appInitializer.isInitialized()) {
  console.log('App is ready!');
}

// Get registered services
const services = appInitializer.getServices();
console.log('Registered services:', services);

// Reset (for testing/development)
appInitializer.reset();
```

### Common Issues

**Issue**: "Playlists not preloaded, loading as fallback"

**Cause**: Hook mounted before AppInitializer completed

**Fix**: Usually harmless, but check that AppInitializer is called in `_layout.tsx`

---

**Issue**: "Critical service X failed"

**Cause**: Database or essential service couldn't initialize

**Fix**: Check device storage, database permissions, or SQL errors

---

**Issue**: "Database is locked"

**Cause**: Concurrent database access

**Fix**: Ensure services use the same `databaseService` instance, not multiple instances

## Performance Considerations

### Parallel vs Sequential

- **Sequential**: Services initialize one after another (current approach)
  - Predictable, easier to debug
  - Total time = sum of all services
  
- **Parallel**: Services initialize simultaneously
  - Faster but more complex
  - Can cause database lock contention

**Recommendation**: Keep sequential unless startup time becomes an issue. SQLite services are fast (<200ms total).

### Lazy Loading Alternative

For truly optional features, consider lazy initialization:

```typescript
// Don't register with AppInitializer
// Load on-demand when feature is accessed
export const useOptionalFeature = () => {
  useEffect(() => {
    if (!isLoaded) {
      loadFeature(); // Load when needed
    }
  }, []);
};
```

## Testing

### Unit Testing Services

```typescript
import {appInitializer} from '@/services/AppInitializer';

beforeEach(() => {
  appInitializer.reset();
});

test('initializes all services', async () => {
  await appInitializer.initialize();
  expect(appInitializer.isInitialized()).toBe(true);
});

test('handles critical service failure', async () => {
  // Mock service to throw error
  await expect(appInitializer.initialize()).rejects.toThrow();
});
```

### Integration Testing

```typescript
import {render, waitFor} from '@testing-library/react-native';
import {appInitializer} from '@/services/AppInitializer';

test('app loads with preloaded data', async () => {
  await appInitializer.initialize();
  
  const {getByText} = render(<CollectionScreen />);
  
  // Should show data immediately, not loading state
  await waitFor(() => {
    expect(getByText('My Playlist')).toBeDefined();
  });
});
```

## Migration Guide

### From On-Demand to Preloaded

If you have existing on-demand loading:

```typescript
// BEFORE: On-demand loading
useEffect(() => {
  loadData();
}, []);

// AFTER: Register with AppInitializer
// 1. Add to services/AppInitializer.ts
appInitializer.registerService({
  name: 'My Feature',
  priority: 10,
  critical: false,
  initialize: async () => {
    await myService.initialize();
    await useMyStore.getState().loadData();
  },
});

// 2. Update hook to use preloaded data
// (Keep fallback for safety)
useEffect(() => {
  if (data.length === 0 && !loading) {
    console.warn('[useMyFeature] Not preloaded, fallback loading');
    loadData();
  }
}, []);
```

## Best Practices

### ✅ DO

- Register SQLite services with AppInitializer
- Use priority to control initialization order
- Mark infrastructure as critical, features as non-critical
- Log initialization progress for debugging
- Keep fallback loading in hooks for safety

### ❌ DON'T

- Initialize database in multiple places
- Mark optional features as critical
- Load large datasets synchronously
- Forget error handling in services
- Skip service registration for SQLite data

## Future Enhancements

Potential improvements to consider:

1. **Parallel Initialization**: Group services by priority, parallelize within groups
2. **Progress Reporting**: Emit progress events for splash screen progress bar
3. **Retry Logic**: Automatic retry for failed non-critical services
4. **Health Checks**: Periodic verification that services are healthy
5. **Dependency Graph**: Explicit service dependencies instead of priorities
6. **Conditional Loading**: Skip services based on feature flags

## Related Documentation

- [Database Service](../services/database/DatabaseService.ts) - SQLite wrapper
- [Playlist Service](../services/playlist/PlaylistService.ts) - Playlist operations
- [Playlists Store](../store/playlistsStore.ts) - State management
- [Version Management](./VERSION-MANAGEMENT.md) - App versioning

## Summary

The AppInitializer provides a robust, extensible system for managing app startup. By preloading SQLite data during initialization, the app feels instant and responsive. Adding new features is as simple as registering them with the initializer.

**Key Takeaway**: Always register SQLite-based services with AppInitializer to ensure data is ready before screens mount.


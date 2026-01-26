# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `PlaylistHeader.tsx`, `FloatingPlayer.tsx`)
- Utilities/Services: camelCase (e.g., `timeUtils.ts`, `playerColorUtils.ts`, `DatabaseService.ts`)
- Hooks: camelCase starting with `use` (e.g., `useUnifiedPlayer.ts`, `useQueue.ts`, `useLoved.ts`)
- Stores: camelCase ending with `Store` (e.g., `playerStore.ts`, `playlistsStore.ts`, `reciterStore.ts`)
- Types/Interfaces: PascalCase in subdirectories (e.g., `types/audio.ts`, `types/reciter.ts`)
- Directories: lowercase with hyphens (e.g., `playlist-detail/`, `reciter-downloads/`, `player-v2/`)

**Functions:**
- camelCase for all functions and methods (e.g., `togglePlayback()`, `setActiveTrack()`, `formatDuration()`)
- Action functions in stores use imperative names (e.g., `setQueue`, `toggleFavoriteTrack`, `clearSleepTimer`)
- Hook functions start with `use` prefix per React conventions (e.g., `usePlayerStore`, `useQueue`)

**Variables:**
- camelCase for all variables (e.g., `isPlaying`, `activeTrackId`, `sleepTimer`, `favoriteTrackIds`)
- Boolean variables use `is` or `has` prefix (e.g., `isLoading`, `isPlaying`, `hasNoTracks`, `isEndOfSurahTimer`)
- Private/internal variables may use `_` prefix in services (e.g., `_db`, `_initPromise`)

**Types:**
- PascalCase for interfaces and types (e.g., `PlayerState`, `Track`, `UserPlaylist`, `PlaylistItem`)
- Suffix interfaces with `Props` for React component props (e.g., `PlaylistHeaderProps`, `LovedHeaderProps`)
- Use `State`, `Actions`, `Row` suffixes for semantic clarity (e.g., `PlayerState`, `PlayerColorActions`, `PlaylistRow`)

## Code Style

**Formatting:**
- Prettier configured in `.prettierrc.json` with:
  - `arrowParens: avoid` - Single parameter arrow functions without parentheses
  - `bracketSameLine: true` - Closing bracket on same line as last property
  - `bracketSpacing: false` - No spaces inside curly braces
  - `singleQuote: true` - Single quotes for strings
  - `trailingComma: all` - Trailing commas in multi-line structures
- Run `npm run format` to format code automatically
- Run `npm run lint:fix` to fix linting issues

**Linting:**
- ESLint configuration in `.eslintrc.cjs` extends:
  - `@react-native-community/eslint-config`
  - `eslint:recommended`
  - `plugin:@typescript-eslint/recommended`
  - `plugin:react/recommended`
  - `plugin:react-hooks/recommended`
  - `prettier` (disables conflicting rules)
- Key rules disabled:
  - `react/prop-types` - Relies on TypeScript for type checking
  - `react/react-in-jsx-scope` - Not needed in modern React
  - `@typescript-eslint/explicit-function-return-type` - Inferred return types acceptable
  - `@typescript-eslint/explicit-module-boundary-types` - Inferred types acceptable
  - `@typescript-eslint/no-var-requires` - Allows require statements in server files
  - `react-native/no-inline-styles` - Inline styles permitted

## Import Organization

**Order:**
1. React and React Native core imports
2. Third-party library imports (Expo, navigation, state management, UI libraries)
3. Project-level absolute imports using `@/` alias
4. Relative imports (rare, used for co-located files)

**Example pattern from `playerStore.ts`:**
```typescript
import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {RepeatMode} from 'react-native-track-player';
import {saveLastTrack, saveLastPosition} from '@/utils/trackPersistence';
import {Track, ensureTrackFields} from '@/types/audio';
import {QueueManager} from '@/services/QueueManager';
import {PlayerColorState, PlayerColorActions} from '@/types/playerColors';
import {PlayerColors, CachedReciterColors} from '@/utils/playerColorUtils';
```

**Path Aliases:**
- `@/*` maps to root directory (configured in `tsconfig.json`)
- Always use absolute imports with `@/` prefix instead of relative paths
- This allows easy file refactoring without updating import paths

## Error Handling

**Patterns:**
- Try-catch blocks for async operations in stores and services
- Log errors to console with descriptive context message:
  ```typescript
  catch (error) {
    console.error('Error in loadAndPlayTrack:', error);
    throw error; // Re-throw for caller to handle
  }
  ```
- Graceful degradation: catch errors without crashing app
- Optimistic updates: update state immediately, revert on error:
  ```typescript
  set({isLoading: true});
  try {
    await TrackPlayer.play();
    set({isLoading: false});
  } catch (error) {
    set({isLoading: false}); // Revert on error
    console.error('Error:', error);
  }
  ```
- Store actions catch errors and log context (see `playerStore.ts` lines 89-92, 117-123)
- Use `handleError` utility for user-facing errors (from `utils/errorHandler.ts`)

**Error Handler Utility:**
- Location: `utils/errorHandler.ts`
- Function: `handleError(error: Error, customMessage?: string)`
- Shows Alert dialog to user with error message
- Logs error to console for debugging

## Logging

**Framework:** `console` object only (no dedicated logging library)

**Patterns:**
- `console.log()` for informational messages, especially in service initialization
- `console.error()` for error conditions with context message
- Service initialization logs prefixed with `[ServiceName]` (e.g., `[AppInitializer] Starting initialization...`)
- Format: `console.error('Descriptive action message:', error)` to provide context for debugging
- Examples from codebase:
  ```typescript
  console.log('[AppInitializer] Already initialized');
  console.log('[AppInitializer] Starting initialization...');
  console.error('Error setting active track:', error);
  console.error('Error in togglePlayback:', error);
  ```

## Comments

**When to Comment:**
- Explain WHY, not WHAT - code should be self-documenting
- Non-obvious algorithmic decisions or workarounds
- Complex state management logic
- Integration points with external APIs
- TODOs for incomplete features (format: `// TODO: Description`)
- Known limitations or edge cases

**JSDoc/TSDoc:**
- Used for exported functions and utilities that need documentation
- Format with `@param`, `@returns` tags
- Example from `utils/validation.ts`:
  ```typescript
  /**
   * Validates an email address.
   * @param email The email address to validate.
   * @returns True if the email is valid, false otherwise.
   */
  export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  ```
- TSDoc for hook and component documentation:
  ```typescript
  /**
   * Hook to interact with the unified player system
   */
  export function useUnifiedPlayer() { ... }
  ```

## Function Design

**Size Guidelines:**
- Keep functions focused on a single responsibility
- Break down complex operations into smaller helper functions
- Average function length in codebase: 10-50 lines for utilities, 30-100 lines for store actions
- Store action methods balance between atomicity and reusability

**Parameters:**
- Maximum 3-4 parameters; use object parameter for related options
- Use destructuring in function signatures when helpful:
  ```typescript
  export const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({
    title,
    subtitle,
    backgroundColor,
    onPlayPress,
  }) => { ... }
  ```
- Async functions should specify what they await and what they return

**Return Values:**
- Functions should return consistent types (not sometimes null, sometimes undefined)
- Async functions in stores return `Promise<void>` unless data is needed
- Utilities return specific types: `boolean`, `string`, `number`, or custom types
- Use type assertions sparingly; prefer type guards

## Module Design

**Exports:**
- Named exports preferred over default exports for utilities and services
- React components use `export const ComponentName` (named export)
- Services export singleton instances or classes
- Example from `playerStore.ts`:
  ```typescript
  export const usePlayerStore = create<PlayerState & PlayerColorActions>()(
    persist(...)
  );
  ```

**Barrel Files:**
- Not heavily used; imports are direct from specific files
- Components in subdirectories don't typically re-export from index files
- Prefer explicit imports for clarity

## Component Structure Pattern

Components follow consistent internal organization (from `PlaylistHeader.tsx` pattern):

```typescript
// 1. Imports (organized by type as documented above)
import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

// 2. Props interface
interface PlaylistHeaderProps {
  title: string;
  subtitle: string;
  backgroundColor: string;
  onPlayPress: () => void;
  onShufflePress: () => void;
  onOptionsPress: () => void;
  theme: Theme;
}

// 3. Component definition
export const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({
  title,
  subtitle,
  backgroundColor,
  onPlayPress,
  onShufflePress,
  onOptionsPress,
  theme,
}) => {
  // 4. Hooks (state, theme, navigation)
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = createStyles(theme, insets);
  const optionsScale = useSharedValue(1);

  // 5. Animated styles
  const optionsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: optionsScale.value}],
  }));

  // 6. Handlers and helper functions
  const handlePress = useCallback(() => {
    onPlayPress();
  }, [onPlayPress]);

  // 7. JSX return
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
};

// 8. Style definitions at bottom
const createStyles = (theme: Theme, insets: EdgeInsets) =>
  ScaledSheet.create({
    container: {
      paddingHorizontal: moderateScale(16),
    },
  });
```

## Type Safety

**TypeScript Configuration:**
- Strict mode enabled in `tsconfig.json`
- `resolveJsonModule: true` - Allows importing JSON files
- Custom type roots: `./types` and `./node_modules/@types`
- Path alias `@/*` for absolute imports

**Typing Practices:**
- Avoid `any` type; use specific types or `unknown` with type guards
- Use type inference where obvious
- Extend library types for custom additions (e.g., `Track extends RNTrackPlayerTrack`)
- Helper types for conversions (e.g., `TrackWithOptionalFields = Partial<Track>`)
- Use type guards and helper functions to ensure field presence:
  ```typescript
  export function ensureTrackFields(track: TrackWithOptionalFields): Track {
    return {
      url: track.url || '',
      title: track.title || '',
      // ... provide defaults for all required fields
    };
  }
  ```

## React and Hooks

**Functional Components:**
- Use `React.FC<Props>` for component typing
- Prefer `function` keyword for custom hooks (e.g., `function useUnifiedPlayer() {}`)
- Use arrow functions for handler/callback definitions
- Destructure props in function parameters

**Hook Patterns:**
- Use `useCallback` for memoized event handlers and effects
- Use `useEffect` for side effects, but minimize usage
- Zustand for global state (see `playerStore.ts` for pattern)
- Custom hooks for component-specific logic (e.g., `useQueue`, `useLoved`)
- Use `useRef` for storing references (e.g., `storeRef` in `useUnifiedPlayer`)

**Memoization:**
- Use `React.memo()` for components with static props
- Use `useMemo` for expensive computations
- Use `useCallback` for callbacks passed to child components or effects
- Minimize re-renders through proper dependency arrays

## Store/State Management

**Zustand Pattern:**
- Location: `store/` directory
- Use `create()` function from Zustand for store definition
- Structure: interface combining State and Actions
- Persist middleware for AsyncStorage integration (see `playerStore.ts` lines 56-397)
- Use `set()` and `get()` for state updates
- Separate concerns into different stores (player, queue, playlist, downloads, etc.)
- Selector pattern: `useStore(state => state.property)`

**Example store structure:**
```typescript
interface PlayerState extends PlayerColorState {
  activeTrackId: string | null;
  isPlaying: boolean;
  // ... state properties
  setQueue: (queue: Track[]) => void;
  togglePlayback: () => Promise<void>;
  // ... action methods
}

export const usePlayerStore = create<PlayerState & PlayerColorActions>()(
  persist(
    (set, get) => ({
      // Initial state
      activeTrackId: null,
      isPlaying: false,

      // Actions
      setQueue: (queue: Track[]) => set({queue}),
      togglePlayback: async () => {
        const state = get();
        // ... implementation
      },
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

---

*Convention analysis: 2026-01-26*

> **ARCHIVED — Historical document.** This was the planning doc for migrating from react-native-track-player to expo-audio. The migration is complete. The current architecture is documented in [docs/architecture/current-state.md](current-state.md) and [docs/features/player.md](../features/player.md).

# Playback Migration Planning Document (Historical)

## Core Principle
- Immediate playback of first track, followed by background batch loading

## Architecture Overview

### 1. Queue Service (`services/queue`)
- **Core Components**:
  - `QueueContext`: Central state and operations manager
  - `QueueOperationManager`: Handles queue operations
  - `BatchLoader`: Efficient batch loading system
  - `useQueue`: React integration hook

### 2. Player Service (`services/player`)
- **Core Components**:
  - Unified state interface
  - Event system
  - Storage layer
  - Background playback service

### 3. Integration Layer
- `useUnifiedPlayer`: Single source of truth for playback
- Combines queue and player services
- Provides consistent interface for components

## Playback Behaviors

### 1. ReciterProfile Screen
- **Play All Button**:
  - Batch load all available surahs for the reciter
  - Start playing from beginning of queue
  - Consider reciter's available surah list
- **Shuffle Button**:
  - Batch load all available surahs
  - Shuffle the queue
  - Start playing from random first track
- **Individual Surah**:
  - Immediately play selected surah
  - Batch load remaining surahs starting from selected one
  - Maintain order from selected surah onwards

### 2. RecentReciterCard (Home Screen)
- **Track Selection**:
  - Resume from last stopped position
  - Batch load remaining surahs by that reciter
  - Update recently played list
- **State Management**:
  - Track recently played items across app
  - Maintain playback positions
  - Update UI when played from other screens

### 3. Collection/Loved Tracks
- **Track Selection**:
  - Play selected track immediately
  - Batch load remaining loved tracks
  - Maintain loved tracks order
- **Play All**:
  - Load and play all loved tracks sequentially
- **Shuffle**:
  - Load all loved tracks
  - Randomize order
  - Start playback

### 4. SurahsView with Reciter Selection
- **Default Reciter**:
  - Play selected surah immediately
  - Batch load remaining surahs
- **Custom Reciter (via ReciterBrowse)**:
  - Play selected surah by chosen reciter
  - Batch load remaining surahs by that reciter

## Current Implementation Analysis

### Legacy Components (To Be Replaced)
- `QueueManager`
- `usePlayback`
- `useQueueStore`
- Direct TrackPlayer usage in components

### New Architecture
1. **State Management**
   - Unified player store (Zustand)
   - Queue context for operation management
   - Event-based state updates
   - Persistent storage layer

2. **Playback Control**
   - Background playback service
   - Remote control handling
   - Audio session management
   - Error recovery system

3. **Queue Management**
   - Priority-based operations
   - Efficient batch loading
   - State validation
   - Error handling

## Migration Strategy

### Phase 1: Core Infrastructure

#### 1. State Management Migration

##### Step 1: Unified Player Store Setup
```typescript
// services/player/store/playerStore.ts

interface UnifiedPlayerState {
  playback: {
    state: PlaybackState;
    position: number;
    duration: number;
    rate: number;
  };
  queue: {
    tracks: Track[];
    currentIndex: number;
    shuffleMode: boolean;
    repeatMode: RepeatMode;
  };
  loading: {
    trackLoading: boolean;
    queueLoading: boolean;
    stateRestoring: boolean;
  };
  error: {
    playback: Error | null;
    queue: Error | null;
    system: Error | null;
  };
  settings: PlaybackSettings;
}

export const usePlayerStore = create<UnifiedPlayerState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...createDefaultState(),

      // Actions
      play: async () => {
        set({ loading: { trackLoading: true }});
        try {
          await TrackPlayer.play();
          set(state => ({
            playback: { ...state.playback, state: 'playing' },
            loading: { trackLoading: false }
          }));
        } catch (error) {
          set(state => ({
            error: { ...state.error, playback: error },
            loading: { trackLoading: false }
          }));
        }
      },
      // ... other actions
    }),
    {
      name: 'player-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

##### Step 2: Queue Context Integration
```typescript
// services/queue/QueueContext.ts

class QueueContext {
  private store: typeof usePlayerStore;
  
  constructor() {
    this.store = usePlayerStore;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen to store changes
    this.store.subscribe(
      (state) => state.queue,
      (queue) => this.handleQueueChange(queue)
    );
  }

  private async handleQueueChange(queue: QueueState) {
    // Sync with TrackPlayer
    await this.syncTracksWithPlayer(queue.tracks);
  }
}
```

##### Step 3: Event System Configuration
```typescript
// services/player/events/bridge.ts

export const setupEventBridge = () => {
  const store = usePlayerStore.getState();

  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    store.updatePlaybackState(event.state);
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    store.setError('playback', event.error);
  });

  // ... other event listeners
};
```

#### 2. Service Integration

##### Step 1: Background Service Setup
```typescript
// services/player/events/playbackService.ts

export async function playbackService() {
  const store = usePlayerStore.getState();

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    store.pause();
  });

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    store.play();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    store.skipToNext();
  });

  // ... other remote control handlers
}
```

##### Step 2: Storage Layer Implementation
```typescript
// services/player/utils/storage.ts

export class StorageManager {
  private static instance: StorageManager;
  
  async persistState(state: Partial<UnifiedPlayerState>) {
    try {
      await AsyncStorage.setItem(
        'player-state',
        JSON.stringify(state)
      );
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  async restoreState(): Promise<Partial<UnifiedPlayerState> | null> {
    try {
      const stored = await AsyncStorage.getItem('player-state');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to restore state:', error);
      return null;
    }
  }
}
```

##### Step 3: Error Recovery System
```typescript
// services/player/utils/errorRecovery.ts

export class ErrorRecovery {
  private static MAX_RETRIES = 3;
  
  async recoverFromError(error: Error, context: string) {
    const store = usePlayerStore.getState();
    
    switch (context) {
      case 'playback':
        await this.handlePlaybackError(error);
        break;
      case 'queue':
        await this.handleQueueError(error);
        break;
      // ... other error types
    }
  }

  private async handlePlaybackError(error: Error) {
    // Implement recovery logic
  }
}
```

#### 3. Testing Infrastructure

##### Step 1: Unit Tests Setup
```typescript
// services/player/__tests__/playerStore.test.ts

describe('PlayerStore', () => {
  beforeEach(async () => {
    await TrackPlayer.reset();
    usePlayerStore.setState(createDefaultState());
  });

  it('should update playback state', async () => {
    const store = usePlayerStore.getState();
    await store.play();
    expect(store.playback.state).toBe('playing');
  });
});
```

##### Step 2: Integration Tests
```typescript
// services/player/__tests__/integration.test.ts

describe('Player Integration', () => {
  it('should handle queue operations with player state', async () => {
    const queueContext = QueueContext.getInstance();
    const store = usePlayerStore.getState();
    
    await queueContext.enqueueOperation({
      type: 'PLAY_TRACK',
      payload: { track: mockTrack }
    });

    expect(store.queue.tracks).toHaveLength(1);
    expect(store.playback.state).toBe('playing');
  });
});
```

#### Implementation Timeline

1. **Week 1: Core Setup**
   - Set up project structure
   - Implement unified player store
   - Basic TrackPlayer integration

2. **Week 2: Queue Integration**
   - Implement queue context
   - Set up operation manager
   - Basic batch loading

3. **Week 3: Event System**
   - Set up event bridge
   - Implement background service
   - Configure remote controls

4. **Week 4: Storage & Testing**
   - Implement storage manager
   - Set up error recovery
   - Write core tests

#### Success Criteria
1. All core components implemented and tested
2. State management working correctly
3. Basic playback operations functional
4. Queue operations working
5. Background playback operational
6. Remote controls responsive
7. State persistence working
8. Error recovery functioning

### Phase 2: Feature Migration

#### 1. Component Migration Strategy

##### A. Utility Functions
```typescript
// utils/track.ts
export function generateSurahRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export async function createTracksForReciter(reciter: Reciter, surahs: number[]): Promise<Track[]> {
  return Promise.all(surahs.map(async (surahNumber) => ({
    id: `${reciter.id}-${surahNumber}`,
    url: await getAudioUrl(reciter.id, surahNumber),
    title: `Surah ${surahNumber}`,
    artist: reciter.name,
    // ... other track metadata
  })));
}
```

##### B. ReciterProfile Screen Migration
```typescript
// components/reciter/ReciterProfile.tsx
function ReciterProfile({ reciter }: { reciter: Reciter }) {
  const { updateQueue, loading } = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();

  const handlePlayAll = async () => {
    try {
      const tracks = await createTracksForReciter(reciter, reciter.availableSurahs);
      await updateQueue(tracks, 0);
      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      // Handle error (show toast, etc.)
    }
  };

  const handleShuffle = async () => {
    try {
      const tracks = await createTracksForReciter(reciter, reciter.availableSurahs);
      await updateQueue(shuffleArray(tracks), 0);
      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      // Handle error
    }
  };

  const handleSurahPlay = async (surahNumber: number) => {
    try {
      const tracks = await createTracksForReciter(reciter, [surahNumber]);
      await updateQueue(tracks, 0);
      queueContext.setCurrentReciter(reciter);
      
      // Background load remaining surahs
      queueContext.batchLoader.loadNextBatchIfNeeded(reciter);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <View>
      <Button 
        onPress={handlePlayAll}
        loading={loading.queueLoading}
        disabled={loading.queueLoading}
      >
        Play All
      </Button>
      {/* ... other UI elements */}
    </View>
  );
}
```

##### C. RecentReciterCard Migration
```typescript
// components/home/RecentReciterCard.tsx
function RecentReciterCard({ reciter, lastPlayedSurah }: Props) {
  const { updateQueue, loading } = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();

  const handlePlay = async () => {
    try {
      // Get last position
      const lastPosition = await getLastPosition(reciter.id, lastPlayedSurah);
      
      // Create and play track
      const tracks = await createTracksForReciter(reciter, [lastPlayedSurah]);
      await updateQueue(tracks, 0);
      if (lastPosition > 0) {
        await TrackPlayer.seekTo(lastPosition);
      }
      
      // Set current reciter and load next batch
      queueContext.setCurrentReciter(reciter);
      queueContext.batchLoader.loadNextBatchIfNeeded(reciter);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePlay}
      disabled={loading.queueLoading}
    >
      {/* ... card content */}
    </TouchableOpacity>
  );
}
```

##### D. Collection/Loved Tracks Migration
```typescript
// components/collection/LovedTracks.tsx
function LovedTracks() {
  const { updateQueue, loading } = useUnifiedPlayer();
  const lovedTracks = useLovedTracksStore(state => state.tracks);

  const handlePlayTrack = async (track: Track, index: number) => {
    try {
      // Play selected track
      await updateQueue([track, ...lovedTracks.slice(index + 1)], 0);
    } catch (error) {
      // Handle error
    }
  };

  const handlePlayAll = async () => {
    try {
      await updateQueue(lovedTracks, 0);
    } catch (error) {
      // Handle error
    }
  };

  const handleShuffle = async () => {
    try {
      await updateQueue(shuffleArray([...lovedTracks]), 0);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <View>
      <FlatList
        data={lovedTracks}
        renderItem={({ item, index }) => (
          <TrackItem
            track={item}
            onPress={() => handlePlayTrack(item, index)}
            disabled={loading.queueLoading}
          />
        )}
      />
    </View>
  );
}
```

##### E. SurahsView Migration
```typescript
// components/surahs/SurahsView.tsx
function SurahsView({ defaultReciter }: { defaultReciter?: Reciter }) {
  const { updateQueue, loading } = useUnifiedPlayer();
  const [selectedReciter, setSelectedReciter] = useState(defaultReciter);
  const queueContext = QueueContext.getInstance();

  const handleSurahPlay = async (surahNumber: number) => {
    if (!selectedReciter) return;

    try {
      // Create and play track
      const tracks = await createTracksForReciter(selectedReciter, [surahNumber]);
      await updateQueue(tracks, 0);
      
      // Set current reciter and load next batch
      queueContext.setCurrentReciter(selectedReciter);
      queueContext.batchLoader.loadNextBatchIfNeeded(selectedReciter);
    } catch (error) {
      // Handle error
    }
  };

  const handleReciterChange = (reciter: Reciter) => {
    setSelectedReciter(reciter);
  };

  return (
    <View>
      <ReciterSelector
        defaultReciter={defaultReciter}
        onReciterChange={handleReciterChange}
      />
      <SurahList
        onSurahPress={handleSurahPlay}
        disabled={loading.queueLoading || !selectedReciter}
      />
    </View>
  );
}
```

#### 2. Implementation Timeline

1. **Week 1: Setup & Utilities**
   - Set up track utility functions
   - Implement shared error handling
   - Create loading state management
   - Set up analytics tracking

2. **Week 2: Core Components**
   - Migrate ReciterProfile
   - Migrate SurahsView
   - Implement proper loading states
   - Add error handling

3. **Week 3: Secondary Components**
   - Migrate RecentReciterCard
   - Migrate Collection/Loved Tracks
   - Add position restoration
   - Implement shuffle functionality

4. **Week 4: Polish & Optimization**
   - Add loading indicators
   - Implement error messages
   - Add analytics events
   - Performance optimization
   - Test all flows

#### 3. Success Criteria

1. **Functionality**
   - All playback features working with useUnifiedPlayer
   - Proper loading states in all components
   - Error handling throughout
   - Analytics tracking working

2. **Performance**
   - No unnecessary re-renders
   - Efficient state updates
   - Quick playback start
   - Smooth background loading

3. **User Experience**
   - Clear loading indicators
   - Helpful error messages
   - Smooth transitions
   - Consistent behavior

4. **Technical**
   - Clean TypeScript types
   - No prop drilling
   - Efficient state management
   - Proper error boundaries

#### 4. Migration Risks & Mitigation

1. **State Management**
   - Risk: Multiple components updating queue simultaneously
   - Mitigation: Use loading states and disable controls

2. **Performance**
   - Risk: State updates causing unnecessary re-renders
   - Mitigation: Proper use of useCallback and useMemo

3. **Error Handling**
   - Risk: Uncaught errors in async operations
   - Mitigation: Consistent error handling pattern

4. **User Experience**
   - Risk: Confusing loading states
   - Mitigation: Clear loading indicators and disabled states

## Questions & Concerns
1. How should we handle the transition period while migrating?
2. What's the best way to test the new system in parallel?
3. How do we ensure state consistency during migration?
4. What's the strategy for migrating existing user data?

## Progress Log

### [Current Date] - Architecture Review
- Analyzed queue service architecture
- Reviewed player service documentation
- Updated migration strategy
- Created implementation examples
- Identified key migration challenges

Next Steps:
1. Review event system implementation
2. Study storage layer details
3. Analyze state persistence strategy
4. Begin Phase 1 implementation planning 
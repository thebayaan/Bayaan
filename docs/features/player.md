# Unified Player System

## Overview
The Unified Player System integrates playback and queue management into a cohesive architecture. This system provides a reliable, performant, and maintainable solution for audio playback in Bayaan.

## Architecture

### Core Components
1. **State Management**
   - Unified state interface
   - State validation
   - Persistence layer
   - Error handling

2. **Event System**
   - Playback events
   - Queue events
   - Error events
   - State synchronization
   - Remote control events
   - Background playback service

3. **Storage Layer**
   - State persistence
   - Audio caching
   - Recovery mechanisms
   - Offline support

### Directory Structure
```
services/player/
├── README.md                 # This documentation
├── types/                    # Type definitions
│   ├── state.ts             # State interfaces
│   ├── events.ts            # Event type definitions
│   └── errors.ts            # Error type definitions
├── store/                    # State management
│   ├── playerStore.ts       # Unified player store
│   └── validation.ts        # State validation
├── events/                   # Event handling
│   ├── bridge.ts            # Event bridge system
│   ├── handlers.ts          # Event handlers
│   └── playbackService.ts   # Background playback service
└── utils/                    # Utilities
    ├── storage.ts           # Storage operations
    └── errors.ts            # Error handling
```

## State Management

### Unified State Interface
The unified state combines playback and queue states into a single, coherent interface:

```typescript
interface UnifiedPlayerState {
  playback: PlaybackState;    // Current playback state
  queue: QueueState;          // Queue state
  loading: LoadingState;      // Loading states
  error: ErrorState;          // Error states
  settings: PlaybackSettings; // Playback settings
  ui: UIState;               // UI-related state
}
```

### State Flow
1. User Action → State Update
2. State Update → Validation
3. Validation → Storage
4. Storage → Event Emission
5. Event → UI Update

## Event System

### Event Types
1. **Playback Events**
   - Track started/ended
   - Playback state changed
   - Progress updated
   - Remote control events
   - Audio session events

2. **Queue Events**
   - Queue updated
   - Position changed
   - Batch loaded

3. **System Events**
   - Error occurred
   - Recovery attempted
   - State synchronized

### Playback Service
The playback service (`playbackService.ts`) handles all background playback functionality:

1. **Remote Controls**
   - Play/Pause/Stop
   - Next/Previous track
   - Seek controls
   - Jump forward/backward

2. **State Management**
   - Playback state updates
   - Track changes
   - Progress tracking
   - Error handling

3. **Audio Session**
   - Interruption handling
   - Audio focus management
   - Background playback

4. **Error Recovery**
   - Automatic retry
   - State restoration
   - Error reporting

## Error Handling

### Error Types
1. **Playback Errors**
   - Loading failures
   - Network issues
   - Format problems
   - Remote control errors

2. **Queue Errors**
   - Batch loading failures
   - State synchronization issues
   - Index out of bounds

3. **System Errors**
   - Storage failures
   - State corruption
   - Recovery failures

### Recovery Strategies
1. **Immediate Recovery**
   - Retry failed operations
   - Load alternative source
   - Reset to known state

2. **Graceful Degradation**
   - Continue with partial data
   - Switch to offline mode
   - Maintain basic functionality

## Usage

### Basic Implementation
```typescript
import {usePlayerStore} from './store/playerStore';

// Access unified state
const {playback, queue} = usePlayerStore();

// Handle playback
const handlePlay = async () => {
  try {
    await playerStore.play();
  } catch (error) {
    handleError(error);
  }
};
```

### Event Handling
```typescript
import {usePlayerEvents} from './events/bridge';

usePlayerEvents({
  onTrackEnd: async () => {
    // Handle track end
  },
  onError: async (error) => {
    // Handle error
  }
});
```

### Playback Service Integration
```typescript
import TrackPlayer from 'react-native-track-player';
import playbackService from './events/playbackService';

// Register the playback service
TrackPlayer.registerPlaybackService(() => playbackService);
```

## Testing

### Unit Tests
- State management
- Event handling
- Error recovery
- Storage operations
- Remote control handling
- Audio session management

### Integration Tests
- State synchronization
- Event propagation
- Error boundaries
- Storage persistence
- Background playback
- Remote controls

## Performance Considerations

### State Updates
- Batch updates when possible
- Minimize re-renders
- Use selective subscriptions
- Implement memoization

### Storage Operations
- Prioritize critical data
- Implement caching
- Use efficient serialization
- Handle storage limits

### Background Processing
- Optimize event handlers
- Minimize background operations
- Efficient audio session management
- Battery usage optimization

## Migration Guide

### From Legacy System
1. Replace direct TrackPlayer calls with store actions
2. Update state management to use unified store
3. Implement error handling using new error system
4. Add event listeners through event bridge
5. Register playback service for background operation
6. Update UI components to use new store
7. Test remote controls and background playback
8. Verify error recovery and state persistence

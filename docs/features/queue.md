# Queue Management System

A robust queue management system for handling audio playback with efficient batch loading and state management.

## Architecture

The system consists of four main components:

1. **QueueContext**: Singleton class that serves as the central point for managing queue state and operations.
2. **QueueOperationManager**: Handles queue operations like playing tracks, adding to queue, etc.
3. **BatchLoader**: Manages efficient loading of track batches to prevent memory issues.
4. **useQueue Hook**: React hook for easy integration with components.

## Usage

### Basic Usage with React Components

```typescript
import { useQueue } from '@/hooks/useQueue';

function AudioPlayer() {
  const {
    currentTrack,
    isLoading,
    playTrack,
    pauseTrack,
    resumeTrack,
    skipToNext,
    skipToPrevious
  } = useQueue();

  if (isLoading) return <Loading />;
  
  return (
    <div>
      <h3>{currentTrack?.title}</h3>
      <div>
        <button onClick={() => skipToPrevious()}>Previous</button>
        <button onClick={() => pauseTrack()}>Pause</button>
        <button onClick={() => resumeTrack()}>Play</button>
        <button onClick={() => skipToNext()}>Next</button>
      </div>
    </div>
  );
}
```

### Managing Batches

```typescript
import { useQueue } from '@/hooks/useQueue';
import { useEffect } from 'react';

function ReciterView({ reciter }) {
  const { setCurrentReciter, loadNextBatch } = useQueue();

  useEffect(() => {
    setCurrentReciter(reciter);
    loadNextBatch(); // Load initial batch
  }, [reciter]);

  return <AudioPlayer />;
}
```

## API Reference

### useQueue Hook

Returns an object with the following properties and methods:

#### State
- `state`: Current queue state
- `currentTrack`: Currently playing track
- `isLoading`: Loading state
- `error`: Any error that occurred

#### Track Operations
- `playTrack(payload)`: Play a specific track
- `pauseTrack()`: Pause current track
- `resumeTrack()`: Resume current track
- `skipToNext()`: Skip to next track
- `skipToPrevious()`: Skip to previous track
- `seekTo(position)`: Seek to position in current track

#### Queue Operations
- `addToQueue(tracks)`: Add tracks to queue
- `removeFromQueue(index)`: Remove track at index
- `clearQueue()`: Clear entire queue

#### Batch Operations
- `setCurrentReciter(reciter)`: Set current reciter for batch loading
- `loadNextBatch(force?)`: Load next batch of tracks

## Error Handling

The system includes comprehensive error handling:

```typescript
const { error } = useQueue();

useEffect(() => {
  if (error) {
    console.error('Queue error:', error);
    // Handle error appropriately
  }
}, [error]);
```

## Best Practices

1. **Batch Loading**: Always set a current reciter before attempting to load batches
2. **Error Handling**: Always handle potential errors in your components
3. **State Management**: Use the provided operations instead of modifying state directly
4. **Cleanup**: The useQueue hook handles cleanup automatically

## Future Improvements

1. Add comprehensive test coverage
2. Implement more sophisticated batch loading strategies
3. Add support for shuffle and repeat modes
4. Improve error recovery mechanisms

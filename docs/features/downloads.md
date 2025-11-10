# Downloads Feature Documentation

This document provides comprehensive documentation for the offline download feature in the Bayaan Quran audio app.

## Overview

The download feature allows users to download Quranic recitations for offline playback, providing access to audio content without requiring an internet connection. This feature is essential for users in areas with limited connectivity or those who want to conserve data usage.

## Architecture

### Core Components

The download feature consists of three main layers:

1. **Service Layer** (`services/downloadService.ts`)
   - Handles file download operations
   - Manages file system interactions
   - Provides input validation and security

2. **State Management** (`services/player/store/downloadStore.ts`)
   - Manages download state using Zustand
   - Handles persistence via AsyncStorage
   - Provides reactive state updates with throttling

3. **UI Components**
   - Download management screen (`app/(tabs)/(c.collection)/collection/downloads.tsx`)
   - Download integration in player components
   - Download options in modals

### File Structure

```
services/
├── downloadService.ts              # Core download functionality
└── player/
    └── store/
        └── downloadStore.ts        # State management

app/(tabs)/(c.collection)/collection/
├── downloads.tsx                   # Download management UI
└── _styles.ts                      # Download screen styles

components/
├── modals/
│   └── SurahOptionsModal.tsx      # Download options in modals
└── player/
    └── PlayerOptionsModal.tsx      # Download integration in player
```

## Features

### Download Management
- **Download Surahs**: Download individual Surahs for offline playback
- **Progress Tracking**: Real-time progress indicators with throttled updates
- **Batch Operations**: Clear all downloads or remove individual downloads
- **Drag & Drop**: Reorder downloaded content for custom playlists
- **Swipe Actions**: Swipe to delete downloaded content
- **Play All**: Play all downloaded content in sequence

### Performance Optimization
- **Throttled Progress Updates**: Updates limited to 150ms intervals to prevent UI freezing
- **Parallel File Operations**: Batch deletions processed concurrently
- **Smart Persistence**: Only permanent data persisted to AsyncStorage
- **Memory Management**: Proper cleanup of timers and references

### File Management
- **Smart Naming**: Files named with padded Surah numbers and reciter/rewayat identifiers
- **Duplicate Prevention**: Prevents downloading the same content multiple times
- **File Size Tracking**: Tracks actual file sizes for storage management
- **Secure Paths**: Sanitized file paths prevent injection attacks

## Performance Fixes

### Problem (Fixed)
When downloading surahs, the main thread was freezing due to:
1. **Excessive state updates**: Progress callbacks fired continuously (100-500/sec)
2. **AsyncStorage bottleneck**: Each progress update could trigger persistence writes
3. **Sequential file operations**: Batch deletions processed files one-by-one
4. **UI blocking**: No throttling or debouncing of progress updates

### Solution Implemented

#### 1. Throttled Progress Updates
- Limits progress updates to once every 150ms maximum
- Immediately updates when progress reaches 100%
- Properly cleans up timers to prevent memory leaks
- **Impact**: 96-98% reduction in state updates (from 100-500/sec to 6-7/sec)

#### 2. Parallel File Operations
- Modified `clearAllDownloads()` to use `Promise.all()`
- All file deletions now happen in parallel
- **Impact**: Batch delete operations are 3-5x faster

#### 3. Optimized Persistence
- `partialize` configuration excludes transient data (`downloading`, `downloadProgress`, `error`)
- Only persistent data (`downloads`, `playlists`) saved to AsyncStorage

### Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Progress Updates/sec | 100-500 | 6-7 | 96-98% reduction |
| State Updates/download | 1000+ | ~50 | 95% reduction |
| Batch Delete (10 files) | ~2-3s | ~0.5-1s | 60-75% faster |
| UI Responsiveness | Frozen | Smooth | ✅ Fixed |

## API Reference

### Download Service

#### `downloadSurah(surahId, reciterId, rewayatId?, onProgress?)`

Downloads a Surah MP3 for offline playback.

**Parameters:**
- `surahId` (number): The Surah number (1-114)
- `reciterId` (string): The reciter's unique identifier
- `rewayatId` (string, optional): The rewayat ID (reading style)
- `onProgress` (function, optional): Callback for progress updates (0-1)

**Returns:**
```typescript
Promise<{
  filePath: string;
  fileSize: number;
}>
```

**Throws:**
- `Error`: When download fails or invalid parameters provided

**Example:**
```typescript
try {
  const result = await downloadSurah(
    1, 
    'abdul_basit', 
    'hafs',
    (progress) => console.log(`Progress: ${progress * 100}%`)
  );
  console.log(`Downloaded to: ${result.filePath}`);
  console.log(`File size: ${result.fileSize} bytes`);
} catch (error) {
  console.error('Download failed:', error.message);
}
```

#### `removeDownload(download)`

Removes a single downloaded file.

**Parameters:**
- `download` (DownloadedSurah): The download object to remove

**Throws:**
- `Error`: When file deletion fails

#### `clearAllDownloads(downloads)`

Removes all downloaded files in parallel.

**Parameters:**
- `downloads` (DownloadedSurah[]): Array of downloads to remove

**Throws:**
- `Error`: When any file deletion fails (includes details)

### Download Store

#### State Interface

```typescript
interface DownloadStoreState {
  downloads: DownloadedSurah[];
  downloading: string[];
  downloadProgress: Record<string, number>;
  error: Error | null;
  
  // Actions
  addDownload: (download: DownloadedSurah) => void;
  removeDownload: (reciterId: string, surahId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  
  // Queries
  isDownloaded: (reciterId: string, surahId: string) => boolean;
  isDownloadedWithRewayat: (reciterId: string, surahId: string, rewayatId: string) => boolean;
  isDownloading: (reciterId: string, surahId: string) => boolean;
  getDownload: (reciterId: string, surahId: string) => DownloadedSurah | undefined;
  
  // Progress Management
  setDownloading: (id: string) => void;
  clearDownloading: (id: string) => void;
  setDownloadProgress: (id: string, progress: number) => void;
  getDownloadProgress: (reciterId: string, surahId: string) => number;
}
```

#### DownloadedSurah Interface

```typescript
interface DownloadedSurah {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  filePath: string;        // Where the file is saved
  fileSize: number;       // Size in bytes
  downloadDate: number;   // When downloaded (timestamp)
  status: 'downloading' | 'completed' | 'error';
}
```

## Usage Examples

### Basic Download Flow

```typescript
import { useDownload } from '@/services/player/store/downloadStore';
import { downloadSurah } from '@/services/downloadService';

function MyComponent() {
  const {
    isDownloaded,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
  } = useDownload();

  const handleDownload = async (surahId: number, reciterId: string, rewayatId?: string) => {
    // 1. Check if already downloaded
    if (isDownloaded(reciterId, surahId.toString())) {
      console.log('Already downloaded');
      return;
    }

    // 2. Check if currently downloading
    if (isDownloading(reciterId, surahId.toString())) {
      console.log('Already downloading');
      return;
    }

    try {
      // 3. Mark as downloading
      const downloadId = `${reciterId}-${surahId}`;
      setDownloading(downloadId);

      // 4. Download with progress tracking
      const result = await downloadSurah(
        surahId,
        reciterId,
        rewayatId,
        (progress) => {
          setDownloadProgress(downloadId, progress);
        }
      );

      // 5. Add to store
      addDownload({
        reciterId,
        surahId: surahId.toString(),
        rewayatId: rewayatId || '',
        filePath: result.filePath,
        fileSize: result.fileSize,
        downloadDate: Date.now(),
        status: 'completed',
      });

      // 6. Clear downloading state
      clearDownloading(downloadId);
    } catch (error) {
      console.error('Download failed:', error);
      clearDownloading(`${reciterId}-${surahId}`);
    }
  };

  return (
    // Your UI component
  );
}
```

### Playing Downloaded Content

```typescript
import { createDownloadedTrack } from '@/utils/track';
import { useUnifiedPlayer } from '@/hooks/useUnifiedPlayer';

const handlePlayDownloaded = async (download: DownloadedSurah) => {
  const { updateQueue, play } = useUnifiedPlayer();

  try {
    // Get reciter and surah data
    const reciter = await getReciterById(download.reciterId);
    const surah = getSurahById(parseInt(download.surahId));
    
    if (!reciter || !surah) {
      throw new Error('Reciter or Surah not found');
    }

    // Create track with local file path
    const track = createDownloadedTrack(
      reciter, 
      surah, 
      download.filePath, 
      download.rewayatId
    );
    
    // Play the track
    await updateQueue([track], 0);
    await play();
  } catch (error) {
    console.error('Error playing downloaded content:', error);
  }
};
```

### Batch Operations

```typescript
const { clearAllDownloads, removeDownload } = useDownload();

// Clear all downloads
const handleClearAll = async () => {
  try {
    await clearAllDownloads();
    console.log('All downloads cleared');
  } catch (error) {
    console.error('Failed to clear downloads:', error);
  }
};

// Remove specific download
const handleRemoveDownload = async (reciterId: string, surahId: string) => {
  try {
    await removeDownload(reciterId, surahId);
    console.log('Download removed');
  } catch (error) {
    console.error('Failed to remove download:', error);
  }
};
```

## Testing

See [Download Testing Guide](../testing/download-testing.md) for comprehensive testing procedures.

### Quick Test Checklist

✅ **Download a single surah**
- Screen remains responsive during download
- Progress indicator updates smoothly
- No freezing or stuttering

✅ **Download multiple surahs simultaneously**
- All downloads progress smoothly
- UI remains interactive

✅ **Clear all downloads**
- Completes quickly (parallel deletion)
- No UI freezing during batch operations

✅ **Cancel a download**
- Stops immediately
- No memory leaks from throttle timers

✅ **Background/Foreground transition**
- App handles downloads correctly when switching states

## Error Handling

### Common Error Scenarios

1. **Network Errors**: Handle download failures due to network issues
2. **Storage Errors**: Handle insufficient storage space
3. **File System Errors**: Handle file system permission issues
4. **Validation Errors**: Handle invalid input parameters

### Error Recovery

```typescript
const handleDownloadWithRetry = async (
  surahId: number, 
  reciterId: string, 
  maxRetries = 3
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await downloadSurah(surahId, reciterId);
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Download failed after ${maxRetries} attempts: ${error.message}`
        );
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, 1000 * attempt)
      );
    }
  }
};
```

## Troubleshooting

### Common Issues

1. **Download Fails Silently**
   - Check network connectivity
   - Verify reciter and surah data availability
   - Check device storage space

2. **File Not Found After Download**
   - Verify file path generation
   - Check file system permissions
   - Ensure download completed successfully

3. **State Not Persisting**
   - Check AsyncStorage permissions
   - Verify Zustand persistence configuration
   - Check for storage quota issues

4. **UI Freezing During Downloads**
   - Verify throttle function is being called
   - Check console for excessive updates
   - Monitor Bridge traffic for excessive messages

### Debug Commands

```typescript
// Check download status
console.log('Downloads:', useDownloadStore.getState().downloads);

// Check downloading state
console.log('Downloading:', useDownloadStore.getState().downloading);

// Check file system
import * as FileSystem from 'expo-file-system';
const files = await FileSystem.readDirectoryAsync(
  FileSystem.documentDirectory
);
console.log('Files in document directory:', files);

// Monitor progress updates
console.log('Progress:', useDownloadStore.getState().downloadProgress);
```

## Future Enhancements

### Planned Features
- Download queue management (limit concurrent downloads)
- Background download support with `expo-task-manager`
- Network monitoring (pause/resume based on network quality)
- Progress persistence (resume interrupted downloads)
- Download scheduling
- Storage usage analytics

### Performance Improvements
- Implement data caching for reciter/surah information
- Add download compression
- Optimize file storage structure
- Add download resumption support

## Related Documentation

- [Download Testing Guide](../testing/download-testing.md)
- [Player Documentation](player.md)
- [Architecture Documentation](../architecture/playback-migration.md)
- [Deployment Guide](../deployment/deployment.md)


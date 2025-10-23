# Bayaan Download Feature Documentation

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
   - Provides reactive state updates

3. **UI Components**
   - Download management screen (`app/(tabs)/(c.collection)/collection/downloads.tsx`)
   - Download integration in player components
   - Download options in modals

## File Structure

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
└── player/v2/PlayerContent/
    └── TrackInfo.tsx               # Download integration in player

utils/
└── track.ts                        # Track creation utilities

## Features

### Download Management
- **Download Surahs**: Download individual Surahs for offline playback
- **Batch Operations**: Clear all downloads or remove individual downloads
- **Drag & Drop**: Reorder downloaded content for custom playlists
- **Swipe Actions**: Swipe to delete downloaded content
- **Play All**: Play all downloaded content in sequence

### File Management
- **Smart Naming**: Files are named with padded Surah numbers and reciter/rewayat identifiers
- **Duplicate Prevention**: Prevents downloading the same content multiple times
- **File Size Tracking**: Tracks actual file sizes for storage management
- **Secure Paths**: Sanitized file paths prevent injection attacks

### User Experience
- **Visual Feedback**: Download progress indicators and status displays
- **Error Handling**: Comprehensive error messages and recovery options
- **Offline Playback**: Seamless playback of downloaded content
- **Storage Management**: Clear visibility of downloaded content

## API Reference

### Download Service

#### `downloadSurah(surahId, reciterId, rewayatId?)`

Downloads a Surah MP3 for offline playback.

**Parameters:**
- `surahId` (number): The Surah number (1-114)
- `reciterId` (string): The reciter's unique identifier
- `rewayatId` (string, optional): The rewayat ID (reading style)

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
  const result = await downloadSurah(1, 'abdul_basit', 'hafs');
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

Removes all downloaded files.

**Parameters:**
- `downloads` (DownloadedSurah[]): Array of downloads to remove

**Throws:**
- `Error`: When any file deletion fails (includes details of failed deletions)

### Download Store

#### State Interface

```typescript
interface DownloadStoreState {
  downloads: DownloadedSurah[];
  downloading: string[];
  error: Error | null;
  
  // Actions
  addDownload: (download: DownloadedSurah) => void;
  removeDownload: (reciterId: string, surahId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  
  // Queries
  isDownloaded: (reciterId: string, surahId: string) => boolean;
  isDownloading: (reciterId: string, surahId: string) => boolean;
  getDownload: (reciterId: string, surahId: string) => DownloadedSurah | undefined;
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

#### Usage Example

```typescript
import { useDownload } from '@/services/player/store/downloadStore';

function MyComponent() {
  const {
    downloads,
    downloading,
    error,
    addDownload,
    removeDownload,
    isDownloaded,
    isDownloading
  } = useDownload();

  const handleDownload = async (surahId: number, reciterId: string) => {
    if (isDownloaded(reciterId, surahId.toString())) {
      console.log('Already downloaded');
      return;
    }

    if (isDownloading(reciterId, surahId.toString())) {
      console.log('Already downloading');
      return;
    }

    try {
      const result = await downloadSurah(surahId, reciterId);
      addDownload({
        reciterId,
        surahId: surahId.toString(),
        rewayatId: '',
        filePath: result.filePath,
        fileSize: result.fileSize,
        downloadDate: Date.now(),
        status: 'completed'
      });
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <View>
      {downloads.map(download => (
        <Text key={`${download.reciterId}-${download.surahId}`}>
          {download.surahId} - {download.fileSize} bytes
        </Text>
      ))}
    </View>
  );
}
```

## File Structure
Throws:
Error: When download fails or invalid parameters provided
Example:
try {
  const result = await downloadSurah(1, 'abdul_basit', 'hafs');
  console.log(`Downloaded to: ${result.filePath}`);
  console.log(`File size: ${result.fileSize} bytes`);
} catch (error) {
  console.error('Download failed:', error.message);
} file names prevent path traversal
- Proper error handling for file operations

### Error Handling
- Comprehensive error messages
- Proper error propagation
- User-friendly error feedback

## Performance Considerations

### File Management
- Efficient file existence checking
- Proper cleanup of failed downloads
- Batch operations for multiple file deletions

### State Management
- Zustand for efficient state updates
- AsyncStorage for persistence
- Minimal re-renders through proper state structure

### Memory Management
- Proper cleanup of file operations
- Efficient data loading patterns
- Optimized UI rendering

## Usage Examples

### Basic Download Flow

```typescript
// 1. Check if already downloaded
if (isDownloaded(reciterId, surahId)) {
  console.log('Already downloaded');
  return;
}

// 2. Start download
setDownloading(`${reciterId}-${surahId}`);

try {
  // 3. Download file
  const result = await downloadSurah(parseInt(surahId), reciterId, rewayatId);
  
  // 4. Add to store
  addDownload({
    reciterId,
    surahId,
    rewayatId,
    filePath: result.filePath,
    fileSize: result.fileSize,
    downloadDate: Date.now(),
    status: 'completed'
  });
} catch (error) {
  console.error('Download failed:', error);
} finally {
  // 5. Clear downloading state
  clearDownloading(`${reciterId}-${surahId}`);
}
```

### Playing Downloaded Content

```typescript
import { createDownloadedTrack } from '@/utils/track';

const handlePlayDownloaded = async (download: DownloadedSurah) => {
  try {
    // Get reciter and surah data
    const reciter = await getReciterById(download.reciterId);
    const surah = getSurahById(parseInt(download.surahId));
    
    if (!reciter || !surah) {
      throw new Error('Reciter or Surah not found');
    }

    // Create track with local file path
    const track = createDownloadedTrack(reciter, surah, download.filePath, download.rewayatId);
    
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

## Error Handling

### Common Error Scenarios

1. **Network Errors**: Handle download failures due to network issues
2. **Storage Errors**: Handle insufficient storage space
3. **File System Errors**: Handle file system permission issues
4. **Validation Errors**: Handle invalid input parameters

### Error Recovery

```typescript
const handleDownloadWithRetry = async (surahId: number, reciterId: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await downloadSurah(surahId, reciterId);
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Download failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

## Testing

### Unit Tests

```typescript
// Example test for download service
describe('downloadService', () => {
  it('should download surah successfully', async () => {
    const result = await downloadSurah(1, 'test_reciter');
    expect(result.filePath).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);
  });

  it('should throw error for invalid surah ID', async () => {
    await expect(downloadSurah(0, 'test_reciter')).rejects.toThrow('Invalid surah ID');
  });
});
```

### Integration Tests

```typescript
// Example test for download store
describe('downloadStore', () => {
  it('should add download to store', () => {
    const store = useDownloadStore.getState();
    const download = createMockDownload();
    
    store.addDownload(download);
    
    expect(store.downloads).toContain(download);
  });
});
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

### Debug Commands

```typescript
// Check download status
console.log('Downloads:', useDownloadStore.getState().downloads);

// Check file system
import * as FileSystem from 'expo-file-system';
const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
console.log('Files in document directory:', files);
```

## Future Enhancements

### Planned Features
- Download progress tracking
- Download queue management
- Storage usage analytics
- Download scheduling
- Background download support

### Performance Improvements
- Implement data caching for reciter/surah information
- Add download compression
- Optimize file storage structure
- Add download resumption

## Contributing

When contributing to the download feature:

1. Follow the existing code patterns
2. Add comprehensive error handling
3. Include unit tests for new functionality
4. Update this documentation for any API changes
5. Ensure backward compatibility




## Related Documentation

- [Playback Migration Guide](docs/playback-migration.md)
- [Version Management](docs/VERSION-MANAGEMENT.md)
- [Deployment Guide](DEPLOYMENT.md)
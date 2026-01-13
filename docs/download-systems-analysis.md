# Download Systems Analysis

## Summary

**UPDATE**: All dead code has been removed. You now have **ONE active download system**.

This document was created to analyze the download systems before cleanup.

---

## System 1: `downloadService.ts` + `services/player/store/downloadStore.ts` ✅ **ACTIVELY USED**

### Files:
- `services/downloadService.ts` - Simple utility functions
- `services/player/store/downloadStore.ts` - Zustand store for player downloads

### How it works:
1. `downloadService.ts` provides simple functions:
   - `downloadSurah()` - Downloads a surah directly using FileSystem
   - `clearAllDownloads()` - Deletes all downloaded files
   - `removeDownload()` - Deletes a single download

2. `services/player/store/downloadStore.ts` is a Zustand store that:
   - Uses `downloadService.ts` functions for actual file operations
   - Manages download state (progress, status, etc.)
   - Stores download metadata

### Used by:
- ✅ `components/player/v2/Modals/PlayerOptionsModal.tsx`
- ✅ `components/modals/SurahOptionsModal.tsx`
- ✅ `components/modals/PlaylistContextMenu.tsx`
- ✅ `app/(tabs)/(c.collection)/collection/loved.tsx`
- ✅ `components/reciter-downloads/ReciterDownloadsList.tsx`
- ✅ `app/(tabs)/(c.collection)/collection/downloads.tsx`
- ✅ `app/(tabs)/(a.home)/settings/storage.tsx`
- ✅ `hooks/usePlayback.ts`
- ✅ `utils/audioUtils.ts`
- ✅ Most other components that handle downloads

### Example usage:
```typescript
import {downloadSurah} from '@/services/downloadService';
import {useDownloadStore} from '@/services/player/store/downloadStore';

// In component:
const {setDownloading, addDownload, clearDownloading, setDownloadProgress} = useDownloadActions();

const downloadResult = await downloadSurah(surahId, reciterId, rewayatId, progress => {
  setDownloadProgress(downloadId, progress);
});

addDownload({
  reciterId,
  surahId: surah.id.toString(),
  rewayatId: rewayatId || '',
  filePath: downloadResult.filePath,
  fileSize: downloadResult.fileSize,
  downloadDate: Date.now(),
  status: 'completed',
});
```

---

## System 2: `DownloadManager` + `store/downloadStore.ts` ❌ **REMOVED**

### Status: **DELETED** - This system was completely unused and has been removed.

### Files that were removed:
- ❌ `services/download/DownloadManager.ts` - Deleted
- ❌ `store/downloadStore.ts` - Deleted
- ❌ `hooks/useDownload.ts` - Deleted
- ❌ `components/DownloadButton.tsx` - Deleted
- ❌ `services/download/OfflineStorageManager.ts` - Deleted
- ❌ `services/download/test.ts` - Deleted
- ❌ `services/download/index.ts` - Deleted
- ❌ `services/download/types.ts` - Deleted

### Also cleaned up:
- Removed `DownloadStatus` and `DownloadableTrack` from `types/audio.ts`

### Issues:
- `DownloadManager.downloadSurah()` is just a placeholder (line 213-217)
- `DownloadManager.downloadReciter()` is just a placeholder (line 203-207)
- The system is set up but not fully implemented

### Example usage:
```typescript
import {useTrackDownload} from '@/hooks/useDownload';

// In DownloadButton component:
const {status, progress, download, pause, resume, cancel, delete: deleteDownload} = useTrackDownload(track);
```

---


---

## The Problem

You have **two download systems**, but only one is actually being used:

1. **Active system** (`downloadService` + player store) - Used by 100% of components
2. **Unused system** (`DownloadManager` + download store) - **NOT USED ANYWHERE**

The `DownloadManager` system appears to be:
- A planned replacement that was never completed
- Not integrated into any components
- Contains placeholder implementations
- Creates confusion about which system to use

---

## Recommendations

### ✅ Completed: Removed Unused System

All dead code has been removed:
1. **Deleted** the unused system:
   - ✅ `services/download/DownloadManager.ts` - Deleted
   - ✅ `store/downloadStore.ts` - Deleted
   - ✅ `hooks/useDownload.ts` - Deleted
   - ✅ `components/DownloadButton.tsx` - Deleted
   - ✅ `services/download/OfflineStorageManager.ts` - Deleted
   - ✅ `services/download/test.ts` - Deleted
   - ✅ `services/download/index.ts` - Deleted
   - ✅ `services/download/types.ts` - Deleted

2. **Kept** the active system:
   - ✅ `services/downloadService.ts`
   - ✅ `services/player/store/downloadStore.ts`
   - ✅ `services/player/store/downloadSelectors.ts`

3. **Cleaned up**:
   - ✅ Removed `DownloadStatus` and `DownloadableTrack` from `types/audio.ts`

### Option 2: Complete the Migration (If you want queue management)
1. Finish implementing `DownloadManager` methods (especially `downloadSurah` and `downloadReciter`)
2. Make `DownloadManager` use `downloadService.ts` internally for actual downloads
3. Migrate all components to use `useDownload` hook
4. Remove `downloadService.ts` direct usage (keep it as internal implementation)

### Option 3: Hybrid Approach
1. Keep `DownloadManager` for future queue management features
2. Make `DownloadManager` use `downloadService.ts` internally
3. Gradually migrate components when queue features are needed

---

## Files to Review

### Currently Active (System 1):
- `services/downloadService.ts` ✅
- `services/player/store/downloadStore.ts` ✅
- `services/player/store/downloadSelectors.ts` ✅

### Removed (System 2):
- ❌ All files deleted - see "System 2" section above


import {useCallback, useEffect, useState} from 'react';
import {useDownloadStore} from '@/store/downloadStore';
import {Track, DownloadableTrack} from '@/types/audio';
import {DownloadOptions, DownloadProgress, DownloadStatus} from '@/services/download/types';

interface UseDownloadReturn {
  // Track-specific state
  isDownloaded: (trackId: string) => boolean;
  getDownloadStatus: (trackId: string) => DownloadStatus;
  getDownloadProgress: (trackId: string) => number;
  getDownloadableTrack: (track: Track) => DownloadableTrack;
  
  // Actions
  downloadTrack: (track: Track, options?: Partial<DownloadOptions>) => Promise<void>;
  downloadTracks: (tracks: Track[], options?: Partial<DownloadOptions>) => Promise<void>;
  pauseDownload: (trackId: string) => Promise<void>;
  resumeDownload: (trackId: string) => Promise<void>;
  cancelDownload: (trackId: string) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  
  // Bulk operations
  downloadReciter: (reciterId: string, rewayatId?: string) => Promise<void>;
  downloadSurah: (surahId: string, reciterIds?: string[]) => Promise<void>;
  
  // State
  downloads: Record<string, any>;
  queue: any[];
  settings: any;
  storageInfo: any;
  isInitialized: boolean;
}

export function useDownload(): UseDownloadReturn {
  const {
    downloads,
    queue,
    settings,
    storageInfo,
    isInitialized,
    initialize,
    addToDownloadQueue,
    removeFromQueue,
    pauseDownload: storePauseDownload,
    resumeDownload: storeResumeDownload,
    deleteDownload: storeDeleteDownload,
    downloadReciter: storeDownloadReciter,
    downloadSurah: storeDownloadSurah,
    getDownloadProgress: storeGetDownloadProgress,
    isTrackDownloaded,
    getLocalPath,
  } = useDownloadStore();

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  const isDownloaded = useCallback((trackId: string): boolean => {
    const download = downloads[trackId];
    return download?.status === 'completed' && !!download.localPath;
  }, [downloads]);

  const getDownloadStatus = useCallback((trackId: string): DownloadStatus => {
    const download = downloads[trackId];
    return download?.status || 'pending';
  }, [downloads]);

  const getDownloadProgress = useCallback((trackId: string): number => {
    const download = downloads[trackId];
    return download?.progress || 0;
  }, [downloads]);

  const getDownloadableTrack = useCallback((track: Track): DownloadableTrack => {
    const download = downloads[track.id];
    
    return {
      ...track,
      isDownloaded: isDownloaded(track.id),
      downloadStatus: getDownloadStatus(track.id),
      downloadProgress: getDownloadProgress(track.id),
      localPath: download?.localPath,
      downloadDate: download?.downloadDate,
      fileSize: download?.totalBytes,
    };
  }, [downloads, isDownloaded, getDownloadStatus, getDownloadProgress]);

  const downloadTrack = useCallback(async (
    track: Track,
    options?: Partial<DownloadOptions>
  ): Promise<void> => {
    await addToDownloadQueue([track], options);
  }, [addToDownloadQueue]);

  const downloadTracks = useCallback(async (
    tracks: Track[],
    options?: Partial<DownloadOptions>
  ): Promise<void> => {
    await addToDownloadQueue(tracks, options);
  }, [addToDownloadQueue]);

  const pauseDownload = useCallback(async (trackId: string): Promise<void> => {
    await storePauseDownload(trackId);
  }, [storePauseDownload]);

  const resumeDownload = useCallback(async (trackId: string): Promise<void> => {
    await storeResumeDownload(trackId);
  }, [storeResumeDownload]);

  const cancelDownload = useCallback(async (trackId: string): Promise<void> => {
    await removeFromQueue(trackId);
  }, [removeFromQueue]);

  const deleteDownload = useCallback(async (trackId: string): Promise<void> => {
    await storeDeleteDownload(trackId);
  }, [storeDeleteDownload]);

  const downloadReciter = useCallback(async (
    reciterId: string,
    rewayatId?: string
  ): Promise<void> => {
    await storeDownloadReciter(reciterId, rewayatId);
  }, [storeDownloadReciter]);

  const downloadSurah = useCallback(async (
    surahId: string,
    reciterIds?: string[]
  ): Promise<void> => {
    await storeDownloadSurah(surahId, reciterIds);
  }, [storeDownloadSurah]);

  return {
    // Track-specific state
    isDownloaded,
    getDownloadStatus,
    getDownloadProgress,
    getDownloadableTrack,
    
    // Actions
    downloadTrack,
    downloadTracks,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    
    // Bulk operations
    downloadReciter,
    downloadSurah,
    
    // State
    downloads,
    queue,
    settings,
    storageInfo,
    isInitialized,
  };
}

// Specialized hook for track-specific download functionality
export function useTrackDownload(track: Track) {
  const {
    isDownloaded,
    getDownloadStatus,
    getDownloadProgress,
    getDownloadableTrack,
    downloadTrack,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
  } = useDownload();

  const [downloadableTrack, setDownloadableTrack] = useState<DownloadableTrack>(
    getDownloadableTrack(track)
  );

  // Update downloadable track when downloads state changes
  useEffect(() => {
    setDownloadableTrack(getDownloadableTrack(track));
  }, [track, getDownloadableTrack]);

  const download = useCallback(async (options?: Partial<DownloadOptions>) => {
    await downloadTrack(track, options);
  }, [downloadTrack, track]);

  const pause = useCallback(async () => {
    await pauseDownload(track.id);
  }, [pauseDownload, track.id]);

  const resume = useCallback(async () => {
    await resumeDownload(track.id);
  }, [resumeDownload, track.id]);

  const cancel = useCallback(async () => {
    await cancelDownload(track.id);
  }, [cancelDownload, track.id]);

  const deleteFile = useCallback(async () => {
    await deleteDownload(track.id);
  }, [deleteDownload, track.id]);

  return {
    track: downloadableTrack,
    isDownloaded: downloadableTrack.isDownloaded,
    status: downloadableTrack.downloadStatus,
    progress: downloadableTrack.downloadProgress || 0,
    localPath: downloadableTrack.localPath,
    downloadDate: downloadableTrack.downloadDate,
    fileSize: downloadableTrack.fileSize,
    
    // Actions
    download,
    pause,
    resume,
    cancel,
    delete: deleteFile,
  };
}
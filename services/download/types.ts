import {Track} from '@/types/audio';

export interface DownloadItem {
  id: string;
  trackId: string;
  track: Track;
  status: DownloadStatus;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  localPath?: string;
  downloadDate?: Date;
  error?: string;
  retryCount: number;
  priority: DownloadPriority;
}

export interface DownloadQueueItem {
  id: string;
  track: Track;
  priority: DownloadPriority;
  createdAt: Date;
  options: DownloadOptions;
}

export interface DownloadOptions {
  quality: AudioQuality;
  wifiOnly: boolean;
  overwrite: boolean;
}

export interface StorageInfo {
  totalSpace: number;
  availableSpace: number;
  usedSpace: number;
  downloadedFiles: number;
  downloadsFolderSize: number;
}

export interface DownloadSettings {
  wifiOnly: boolean;
  maxConcurrentDownloads: number;
  autoCleanup: boolean;
  maxStorageUsage: number; // Percentage
  downloadQuality: AudioQuality;
  autoDownloadFavorites: boolean;
  backgroundDownloads: boolean;
}

export interface DownloadProgress {
  trackId: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

export type DownloadStatus =
  | 'pending'
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DownloadPriority = 'low' | 'normal' | 'high';

export type AudioQuality = '128' | '192' | '320';

export interface DownloadMetadata {
  version: string;
  downloads: Record<string, DownloadItem>;
  settings: DownloadSettings;
  lastUpdated: Date;
}

export interface BulkDownloadRequest {
  type: 'reciter' | 'surah' | 'playlist';
  reciterId?: string;
  rewayatId?: string;
  surahIds?: string[];
  tracks?: Track[];
  options: DownloadOptions;
}

// Events
export interface DownloadEvent {
  type: DownloadEventType;
  payload: any;
}

export type DownloadEventType =
  | 'download_started'
  | 'download_progress'
  | 'download_completed'
  | 'download_failed'
  | 'download_paused'
  | 'download_resumed'
  | 'download_cancelled'
  | 'queue_updated'
  | 'storage_warning'
  | 'storage_full';

// Error types
export class DownloadError extends Error {
  constructor(
    message: string,
    public code: DownloadErrorCode,
    public trackId?: string,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

export type DownloadErrorCode =
  | 'NETWORK_ERROR'
  | 'STORAGE_FULL'
  | 'FILE_SYSTEM_ERROR'
  | 'INVALID_URL'
  | 'PERMISSION_DENIED'
  | 'DOWNLOAD_CANCELLED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'BACKGROUND_RESTRICTED';

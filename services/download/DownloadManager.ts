import NetInfo from '@react-native-community/netinfo';
import {Track} from '@/types/audio';
import {OfflineStorageManager} from './OfflineStorageManager';
import {
  DownloadItem,
  DownloadQueueItem,
  DownloadOptions,
  DownloadProgress,
  DownloadStatus,
  BulkDownloadRequest,
  DownloadEvent,
  DownloadError,
  DownloadSettings,
  StorageInfo,
} from './types';
import {performance} from '@/utils/performance';
import {EventEmitter} from 'events';

export class DownloadManager extends EventEmitter {
  private static instance: DownloadManager;
  private storageManager: OfflineStorageManager;
  private downloadQueue: DownloadQueueItem[] = [];
  private activeDownloads: Map<string, AbortController> = new Map();
  private settings: DownloadSettings;
  private isInitialized = false;
  private networkState = {isConnected: true, isWiFi: false};

  private constructor() {
    super();
    this.storageManager = OfflineStorageManager.getInstance();
    this.settings = {
      wifiOnly: true,
      maxConcurrentDownloads: 3,
      autoCleanup: true,
      maxStorageUsage: 80,
      downloadQuality: '192',
      autoDownloadFavorites: false,
      backgroundDownloads: true,
    };
  }

  static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * Initialize the download manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.storageManager.initialize();
      await this.loadSettings();
      await this.setupNetworkMonitoring();
      await this.resumePendingDownloads();

      this.isInitialized = true;
      console.log('DownloadManager initialized');
    } catch (error) {
      console.error('Failed to initialize DownloadManager:', error);
      throw error;
    }
  }

  /**
   * Add tracks to download queue
   */
  async addToDownloadQueue(
    tracks: Track[],
    options: Partial<DownloadOptions> = {},
  ): Promise<void> {
    const defaultOptions: DownloadOptions = {
      quality: this.settings.downloadQuality,
      wifiOnly: this.settings.wifiOnly,
      overwrite: false,
    };

    const finalOptions = {...defaultOptions, ...options};

    for (const track of tracks) {
      // Check if already downloaded and not overwriting
      if (!finalOptions.overwrite) {
        const existingPath = await this.storageManager.retrieveTrack(track.id);
        if (existingPath) {
          console.log(`Track already downloaded: ${track.title}`);
          continue;
        }
      }

      const queueItem: DownloadQueueItem = {
        id: `download_${track.id}_${Date.now()}`,
        track,
        priority: 'normal',
        createdAt: new Date(),
        options: finalOptions,
      };

      this.downloadQueue.push(queueItem);
    }

    this.emit('queue_updated', {queue: this.downloadQueue});
    await this.processQueue();
  }

  /**
   * Remove track from download queue
   */
  async removeFromQueue(trackId: string): Promise<void> {
    // Remove from queue
    this.downloadQueue = this.downloadQueue.filter(
      item => item.track.id !== trackId,
    );

    // Cancel active download if exists
    const activeController = this.activeDownloads.get(trackId);
    if (activeController) {
      activeController.abort();
      this.activeDownloads.delete(trackId);
    }

    this.emit('queue_updated', {queue: this.downloadQueue});
  }

  /**
   * Pause a download
   */
  async pauseDownload(trackId: string): Promise<void> {
    const activeController = this.activeDownloads.get(trackId);
    if (activeController) {
      activeController.abort();
      this.activeDownloads.delete(trackId);

      // Update status in metadata
      const metadata = await this.storageManager.getDownloadMetadata();
      const downloadItem = Object.values(metadata.downloads).find(
        item => item.trackId === trackId,
      );

      if (downloadItem) {
        downloadItem.status = 'paused';
        await this.storageManager.updateDownloadMetadata(
          downloadItem.id,
          downloadItem,
        );
      }

      this.emit('download_paused', {trackId});
    }
  }

  /**
   * Resume a download
   */
  async resumeDownload(trackId: string): Promise<void> {
    const metadata = await this.storageManager.getDownloadMetadata();
    const downloadItem = Object.values(metadata.downloads).find(
      item => item.trackId === trackId && item.status === 'paused',
    );

    if (downloadItem) {
      // Add back to queue
      const queueItem: DownloadQueueItem = {
        id: `resume_${trackId}_${Date.now()}`,
        track: downloadItem.track,
        priority: 'normal',
        createdAt: new Date(),
        options: {
          quality: this.settings.downloadQuality,
          wifiOnly: this.settings.wifiOnly,
          overwrite: true,
        },
      };

      this.downloadQueue.unshift(queueItem); // Add to front of queue
      this.emit('download_resumed', {trackId});
      await this.processQueue();
    }
  }

  /**
   * Get download progress for a track
   */
  getDownloadProgress(trackId: string): DownloadProgress | null {
    // This would be implemented with real download progress tracking
    // For now, return null as placeholder
    return null;
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    return await this.storageManager.getStorageInfo();
  }

  /**
   * Bulk download operations
   */
  async downloadReciter(reciterId: string, rewayatId?: string): Promise<void> {
    // Implementation would depend on your reciter data structure
    // This is a placeholder for bulk download functionality
    console.log(`Bulk download reciter: ${reciterId}, rewayat: ${rewayatId}`);
  }

  /**
   * Download specific surah from multiple reciters
   */
  async downloadSurah(surahId: string, reciterIds?: string[]): Promise<void> {
    // Implementation for downloading a surah from multiple reciters
    console.log(
      `Download surah: ${surahId} from reciters: ${reciterIds?.join(', ')}`,
    );
  }

  /**
   * Get all downloads
   */
  async getAllDownloads(): Promise<DownloadItem[]> {
    const metadata = await this.storageManager.getDownloadMetadata();
    return Object.values(metadata.downloads);
  }

  /**
   * Delete a downloaded track
   */
  async deleteDownload(trackId: string): Promise<void> {
    await this.storageManager.deleteTrack(trackId);
    this.emit('download_deleted', {trackId});
  }

  /**
   * Update download settings
   */
  async updateSettings(newSettings: Partial<DownloadSettings>): Promise<void> {
    this.settings = {...this.settings, ...newSettings};
    await this.storageManager.updateSettings(this.settings);

    // Adjust active downloads based on new settings
    if (newSettings.maxConcurrentDownloads !== undefined) {
      await this.adjustConcurrentDownloads();
    }
  }

  /**
   * Check if track is downloaded
   */
  async isTrackDownloaded(trackId: string): Promise<boolean> {
    const localPath = await this.storageManager.retrieveTrack(trackId);
    return localPath !== null;
  }

  /**
   * Get local path for downloaded track
   */
  async getLocalPath(trackId: string): Promise<string | null> {
    return await this.storageManager.retrieveTrack(trackId);
  }

  // Private methods

  private async processQueue(): Promise<void> {
    if (this.downloadQueue.length === 0) return;

    // Check network conditions
    if (!this.canDownload()) {
      console.log('Cannot download: network conditions not met');
      return;
    }

    // Process queue up to max concurrent downloads
    const maxConcurrent = this.settings.maxConcurrentDownloads;
    const currentActive = this.activeDownloads.size;
    const slotsAvailable = maxConcurrent - currentActive;

    if (slotsAvailable <= 0) return;

    const itemsToProcess = this.downloadQueue
      .filter(item => !this.activeDownloads.has(item.track.id))
      .slice(0, slotsAvailable);

    for (const item of itemsToProcess) {
      await this.startDownload(item);
    }
  }

  private async startDownload(queueItem: DownloadQueueItem): Promise<void> {
    const {track} = queueItem;
    const abortController = new AbortController();

    this.activeDownloads.set(track.id, abortController);

    // Create download item
    const downloadItem: DownloadItem = {
      id: queueItem.id,
      trackId: track.id,
      track,
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      retryCount: 0,
      priority: queueItem.priority,
    };

    try {
      // Update metadata
      await this.storageManager.updateDownloadMetadata(
        downloadItem.id,
        downloadItem,
      );

      this.emit('download_started', {trackId: track.id});

      // Perform the actual download
      const tempDownloadUri = await this.performDownload(
        track.url,
        abortController.signal,
        progress => {
          downloadItem.progress = progress.progress;
          downloadItem.downloadedBytes = progress.downloadedBytes;
          downloadItem.totalBytes = progress.totalBytes;

          this.emit('download_progress', {
            trackId: track.id,
            progress: progress.progress,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          });
        },
      );

      // Store the downloaded file
      const localPath = await this.storageManager.storeTrack(
        track,
        tempDownloadUri,
        downloadItem,
      );

      downloadItem.status = 'completed';
      downloadItem.progress = 100;
      downloadItem.localPath = localPath;
      downloadItem.downloadDate = new Date();

      await this.storageManager.updateDownloadMetadata(
        downloadItem.id,
        downloadItem,
      );

      // Remove from queue and active downloads
      this.downloadQueue = this.downloadQueue.filter(
        item => item.id !== queueItem.id,
      );
      this.activeDownloads.delete(track.id);

      this.emit('download_completed', {trackId: track.id, localPath});

      // Continue processing queue
      await this.processQueue();
    } catch (error) {
      downloadItem.status = 'failed';
      downloadItem.error =
        error instanceof Error ? error.message : 'Unknown error';
      downloadItem.retryCount++;

      await this.storageManager.updateDownloadMetadata(
        downloadItem.id,
        downloadItem,
      );

      this.activeDownloads.delete(track.id);

      // Retry logic
      if (downloadItem.retryCount < 3) {
        // Add back to queue for retry
        setTimeout(() => {
          this.downloadQueue.push(queueItem);
          this.processQueue();
        }, 5000 * downloadItem.retryCount); // Exponential backoff
      } else {
        this.emit('download_failed', {
          trackId: track.id,
          error: downloadItem.error,
        });
      }
    }
  }

  private async performDownload(
    url: string,
    signal: AbortSignal,
    onProgress: (progress: {
      progress: number;
      downloadedBytes: number;
      totalBytes: number;
    }) => void,
  ): Promise<string> {
    // Use FileSystem.downloadAsync for better performance and native handling
    const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
    const cacheDir = FileSystem.cacheDirectory?.endsWith('/')
      ? FileSystem.cacheDirectory
      : FileSystem.cacheDirectory + '/';
    const tempFileUri = cacheDir + tempFileName;

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        tempFileUri,
        {},
        downloadProgress => {
          const {totalBytesWritten, totalBytesExpectedToWrite} =
            downloadProgress;
          const progress =
            totalBytesExpectedToWrite > 0
              ? (totalBytesWritten / totalBytesExpectedToWrite) * 100
              : 0;

          onProgress({
            progress,
            downloadedBytes: totalBytesWritten,
            totalBytes: totalBytesExpectedToWrite,
          });
        },
      );

      // Handle abort signal
      const abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          downloadResumable.pauseAsync().then(() => {
            FileSystem.deleteAsync(tempFileUri, {idempotent: true});
            reject(new Error('Download cancelled'));
          });
        });
      });

      const downloadPromise = downloadResumable.downloadAsync();
      const result = await Promise.race([downloadPromise, abortPromise]);

      if (!result) {
        throw new Error('Download failed: No result returned');
      }

      // Verify the file was downloaded
      const fileInfo = await FileSystem.getInfoAsync(tempFileUri);
      if (!fileInfo.exists) {
        throw new Error('Download failed: File not found after download');
      }

      return tempFileUri;
    } catch (error) {
      // Clean up temp file on error
      try {
        await FileSystem.deleteAsync(tempFileUri, {idempotent: true});
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }
      throw error;
    }
  }

  private canDownload(): boolean {
    if (!this.networkState.isConnected) return false;
    if (this.settings.wifiOnly && !this.networkState.isWiFi) return false;
    return true;
  }

  private async setupNetworkMonitoring(): Promise<void> {
    NetInfo.addEventListener(state => {
      this.networkState = {
        isConnected: state.isConnected || false,
        isWiFi: state.type === 'wifi',
      };

      // Resume downloads if network conditions are now met
      if (this.canDownload() && this.downloadQueue.length > 0) {
        this.processQueue();
      }
    });
  }

  private async loadSettings(): Promise<void> {
    const metadata = await this.storageManager.getDownloadMetadata();
    this.settings = metadata.settings;
  }

  private async resumePendingDownloads(): Promise<void> {
    const metadata = await this.storageManager.getDownloadMetadata();

    // Find downloads that were in progress and add them back to queue
    const pendingDownloads = Object.values(metadata.downloads).filter(
      item => item.status === 'downloading' || item.status === 'queued',
    );

    for (const download of pendingDownloads) {
      const queueItem: DownloadQueueItem = {
        id: `resume_${download.id}`,
        track: download.track,
        priority: download.priority,
        createdAt: new Date(),
        options: {
          quality: this.settings.downloadQuality,
          wifiOnly: this.settings.wifiOnly,
          overwrite: true,
        },
      };

      this.downloadQueue.push(queueItem);
    }

    if (this.downloadQueue.length > 0) {
      console.log(`Resumed ${this.downloadQueue.length} pending downloads`);
      await this.processQueue();
    }
  }

  private async adjustConcurrentDownloads(): Promise<void> {
    const currentActive = this.activeDownloads.size;
    const maxAllowed = this.settings.maxConcurrentDownloads;

    if (currentActive > maxAllowed) {
      // Cancel excess downloads
      const activeEntries = Array.from(this.activeDownloads.entries());
      const toCancel = activeEntries.slice(maxAllowed);

      for (const [trackId, controller] of toCancel) {
        controller.abort();
        this.activeDownloads.delete(trackId);
        await this.pauseDownload(trackId);
      }
    } else if (currentActive < maxAllowed && this.downloadQueue.length > 0) {
      // Start more downloads if queue has items
      await this.processQueue();
    }
  }
}

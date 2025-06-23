import * as FileSystem from 'expo-file-system';
import {Track} from '@/types/audio';
import {
  DownloadItem,
  DownloadMetadata,
  StorageInfo,
  DownloadSettings,
} from './types';
import {performance} from '@/utils/performance';

export class OfflineStorageManager {
  private static instance: OfflineStorageManager;
  private baseDirectory: string;
  private metadataFile: string;
  private cacheDirectory: string;

  private constructor() {
    this.baseDirectory = FileSystem.documentDirectory + 'downloads/';
    this.metadataFile = this.baseDirectory + 'metadata.json';
    this.cacheDirectory = this.baseDirectory + 'cache/';
  }

  static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager();
    }
    return OfflineStorageManager.instance;
  }

  /**
   * Initialize the storage system
   */
  async initialize(): Promise<void> {
    try {
      // Create base directories
      await this.ensureDirectoryExists(this.baseDirectory);
      await this.ensureDirectoryExists(this.cacheDirectory);
      await this.ensureDirectoryExists(this.baseDirectory + 'reciters/');

      // Initialize metadata file if it doesn't exist
      await this.initializeMetadata();

      console.log('OfflineStorageManager initialized');
    } catch (error) {
      console.error('Failed to initialize OfflineStorageManager:', error);
      throw error;
    }
  }

  /**
   * Store a downloaded track to the file system
   */
  async storeTrack(
    track: Track,
    audioData: string,
    downloadItem: DownloadItem,
  ): Promise<string> {
    const start = performance.now();

    try {
      const filePath = this.generateFilePath(track);
      await this.ensureDirectoryExists(this.getDirectoryFromPath(filePath));

      // Write the audio file
      await FileSystem.writeAsStringAsync(filePath, audioData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Update metadata
      await this.updateDownloadMetadata(downloadItem.id, {
        ...downloadItem,
        localPath: filePath,
        status: 'completed',
        downloadDate: new Date(),
      });

      const end = performance.now();
      console.log(`Track stored in ${end - start}ms: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('Failed to store track:', error);
      throw error;
    }
  }

  /**
   * Retrieve a downloaded track from the file system
   */
  async retrieveTrack(trackId: string): Promise<string | null> {
    try {
      const metadata = await this.getDownloadMetadata();
      const downloadItem = metadata.downloads[trackId];

      if (!downloadItem?.localPath || downloadItem.status !== 'completed') {
        return null;
      }

      const exists = await FileSystem.getInfoAsync(downloadItem.localPath);
      if (!exists.exists) {
        // File was deleted externally, update metadata
        await this.removeDownloadFromMetadata(trackId);
        return null;
      }

      return downloadItem.localPath;
    } catch (error) {
      console.error('Failed to retrieve track:', error);
      return null;
    }
  }

  /**
   * Delete a downloaded track
   */
  async deleteTrack(trackId: string): Promise<void> {
    try {
      const metadata = await this.getDownloadMetadata();
      const downloadItem = metadata.downloads[trackId];

      if (downloadItem?.localPath) {
        const exists = await FileSystem.getInfoAsync(downloadItem.localPath);
        if (exists.exists) {
          await FileSystem.deleteAsync(downloadItem.localPath);
        }
      }

      await this.removeDownloadFromMetadata(trackId);
      console.log(`Track deleted: ${trackId}`);
    } catch (error) {
      console.error('Failed to delete track:', error);
      throw error;
    }
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const [downloadsFolderSize, deviceStorage] = await Promise.all([
        this.calculateFolderSize(this.baseDirectory),
        this.getDeviceStorageInfo(),
      ]);

      const metadata = await this.getDownloadMetadata();
      const downloadedFiles = Object.keys(metadata.downloads).length;

      return {
        totalSpace: deviceStorage.totalSpace,
        availableSpace: deviceStorage.availableSpace,
        usedSpace: deviceStorage.totalSpace - deviceStorage.availableSpace,
        downloadedFiles,
        downloadsFolderSize,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned files
   */
  async cleanupOrphanedFiles(): Promise<void> {
    try {
      const metadata = await this.getDownloadMetadata();
      const expectedFiles = new Set(
        Object.values(metadata.downloads)
          .filter(item => item.localPath)
          .map(item => item.localPath!),
      );

      await this.cleanupDirectory(
        this.baseDirectory + 'reciters/',
        expectedFiles,
      );
      console.log('Orphaned files cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup orphaned files:', error);
    }
  }

  /**
   * Get download metadata
   */
  async getDownloadMetadata(): Promise<DownloadMetadata> {
    try {
      const exists = await FileSystem.getInfoAsync(this.metadataFile);
      if (!exists.exists) {
        return this.createDefaultMetadata();
      }

      const content = await FileSystem.readAsStringAsync(this.metadataFile);
      const metadata = JSON.parse(content) as DownloadMetadata;

      // Validate and migrate if necessary
      return this.validateMetadata(metadata);
    } catch (error) {
      console.error('Failed to get download metadata:', error);
      return this.createDefaultMetadata();
    }
  }

  /**
   * Update download metadata for a specific item
   */
  async updateDownloadMetadata(
    downloadId: string,
    downloadItem: DownloadItem,
  ): Promise<void> {
    try {
      const metadata = await this.getDownloadMetadata();
      metadata.downloads[downloadId] = downloadItem;
      metadata.lastUpdated = new Date();

      await FileSystem.writeAsStringAsync(
        this.metadataFile,
        JSON.stringify(metadata, null, 2),
      );
    } catch (error) {
      console.error('Failed to update download metadata:', error);
      throw error;
    }
  }

  /**
   * Remove download from metadata
   */
  async removeDownloadFromMetadata(downloadId: string): Promise<void> {
    try {
      const metadata = await this.getDownloadMetadata();
      delete metadata.downloads[downloadId];
      metadata.lastUpdated = new Date();

      await FileSystem.writeAsStringAsync(
        this.metadataFile,
        JSON.stringify(metadata, null, 2),
      );
    } catch (error) {
      console.error('Failed to remove download from metadata:', error);
      throw error;
    }
  }

  /**
   * Update download settings
   */
  async updateSettings(settings: Partial<DownloadSettings>): Promise<void> {
    try {
      const metadata = await this.getDownloadMetadata();
      metadata.settings = {...metadata.settings, ...settings};
      metadata.lastUpdated = new Date();

      await FileSystem.writeAsStringAsync(
        this.metadataFile,
        JSON.stringify(metadata, null, 2),
      );
    } catch (error) {
      console.error('Failed to update download settings:', error);
      throw error;
    }
  }

  // Private helper methods

  private generateFilePath(track: Track): string {
    const reciterPath = this.sanitizeFilename(track.reciterName);
    const rewayatPath = track.rewayatId
      ? this.sanitizeFilename(track.rewayatId)
      : 'default';
    const surahPath = this.sanitizeFilename(`${track.surahId}-${track.title}`);

    return `${this.baseDirectory}reciters/${reciterPath}/${rewayatPath}/${surahPath}.mp3`;
  }

  private getDirectoryFromPath(filePath: string): string {
    return filePath.substring(0, filePath.lastIndexOf('/'));
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase();
  }

  private async ensureDirectoryExists(directory: string): Promise<void> {
    const exists = await FileSystem.getInfoAsync(directory);
    if (!exists.exists) {
      await FileSystem.makeDirectoryAsync(directory, {intermediates: true});
    }
  }

  private async initializeMetadata(): Promise<void> {
    const exists = await FileSystem.getInfoAsync(this.metadataFile);
    if (!exists.exists) {
      const defaultMetadata = this.createDefaultMetadata();
      await FileSystem.writeAsStringAsync(
        this.metadataFile,
        JSON.stringify(defaultMetadata, null, 2),
      );
    }
  }

  private createDefaultMetadata(): DownloadMetadata {
    return {
      version: '1.0.0',
      downloads: {},
      settings: {
        wifiOnly: true,
        maxConcurrentDownloads: 3,
        autoCleanup: true,
        maxStorageUsage: 80,
        downloadQuality: '192',
        autoDownloadFavorites: false,
        backgroundDownloads: true,
      },
      lastUpdated: new Date(),
    };
  }

  private validateMetadata(metadata: DownloadMetadata): DownloadMetadata {
    // Add validation and migration logic here
    if (!metadata.version) {
      metadata.version = '1.0.0';
    }

    if (!metadata.settings) {
      metadata.settings = this.createDefaultMetadata().settings;
    }

    return metadata;
  }

  private async calculateFolderSize(folderPath: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(folderPath);
      if (!info.exists) {
        return 0;
      }

      if (info.isDirectory) {
        const items = await FileSystem.readDirectoryAsync(folderPath);
        let totalSize = 0;

        for (const item of items) {
          const itemPath = `${folderPath}/${item}`;
          const itemSize = await this.calculateFolderSize(itemPath);
          totalSize += itemSize;
        }

        return totalSize;
      } else {
        return info.size || 0;
      }
    } catch (error) {
      console.error('Failed to calculate folder size:', error);
      return 0;
    }
  }

  private async getDeviceStorageInfo(): Promise<{
    totalSpace: number;
    availableSpace: number;
  }> {
    try {
      const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      return {
        totalSpace: info.size || 0,
        availableSpace: info.size || 0, // This is a simplified implementation
      };
    } catch (error) {
      console.error('Failed to get device storage info:', error);
      return {totalSpace: 0, availableSpace: 0};
    }
  }

  private async cleanupDirectory(
    directory: string,
    expectedFiles: Set<string>,
  ): Promise<void> {
    try {
      const exists = await FileSystem.getInfoAsync(directory);
      if (!exists.exists || !exists.isDirectory) {
        return;
      }

      const items = await FileSystem.readDirectoryAsync(directory);

      for (const item of items) {
        const itemPath = `${directory}/${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);

        if (itemInfo.isDirectory) {
          await this.cleanupDirectory(itemPath, expectedFiles);
        } else if (!expectedFiles.has(itemPath)) {
          await FileSystem.deleteAsync(itemPath);
          console.log(`Deleted orphaned file: ${itemPath}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup directory:', error);
    }
  }
}
